import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import {
  createPublicationFixture,
  type PublicationFixtureContext,
} from "../../../tests/fixtures/publication-flow";
import { publishListing } from "../selling/publish.server";
import {
  readPublishedListing,
  readPublishedPhoto,
} from "../catalog/published.server";
import {
  readPublicDiscovery,
  readPublicSeller,
} from "../catalog/public-discovery.server";
import { readDiscoveryInput } from "../catalog/discovery-input";
import { withdrawListing } from "../selling/publication.server";
import { saveListingDraft, readListingDraft } from "../selling/drafts.server";
import { createListingDraft } from "../selling/drafts.server";
import { emptyDraft } from "../selling/draft-model";
import { readLibrary } from "./queries.server";
import { changeLibrary } from "./commands.server";
import type { LibraryOperation } from "./model";
import type { SellerDatabase } from "../../server/db/database";

type Context = PublicationFixtureContext & { fresh: () => SellerDatabase };
export function defineLibraryIntegrationCases(get: () => Context) {
  describe("buyer library with real PostgreSQL persistence", () => {
    const priorKey = process.env.TREIDO_DISCOVERY_CURSOR_KEY;
    const identity = () => ({
      subject: "user_library_" + randomUUID().replaceAll("-", ""),
    });
    let fixture: Awaited<ReturnType<typeof createPublicationFixture>>;
    let publicationRevision: number;
    const command = async (
      actor: { subject: string },
      operation: LibraryOperation,
    ) => {
      const current = await readLibrary(get().database, actor, {});
      return {
        actorKey: current.actorKey,
        expectedRevision: current.revision,
        requestId: randomUUID(),
        operation,
      };
    };
    const change = async (
      actor: { subject: string },
      operation: LibraryOperation,
    ) => changeLibrary(get().database, actor, await command(actor, operation));
    beforeAll(async () => {
      process.env.TREIDO_DISCOVERY_CURSOR_KEY = randomBytes(32).toString("hex");
      const ctx = get();
      await ctx.admin.query(
        "UPDATE treido.category_policies SET state='reviewed',enabled_for_publish=true,review_reference='SYNTHETIC LIBRARY TEST ONLY',reviewed_at=now() WHERE category_id='cat:electronics/phones' AND version=1",
      );
      fixture = await createPublicationFixture(ctx);
      publicationRevision = (
        await publishListing(ctx.database, ctx.owner, fixture.input)
      ).revision;
    });
    afterAll(async () => {
      await get().admin.query(
        "UPDATE treido.category_policies SET state='pending',enabled_for_publish=false,review_reference=NULL,reviewed_at=NULL WHERE category_id='cat:electronics/phones' AND version=1",
      );
      if (priorKey === undefined)
        delete process.env.TREIDO_DISCOVERY_CURSOR_KEY;
      else process.env.TREIDO_DISCOVERY_CURSOR_KEY = priorKey;
    });
    it("keeps initial reads side-effect free and saves across a fresh runtime connection", async () => {
      const actor = identity();
      const count = async () =>
        (
          await get().admin.query(
            "SELECT (SELECT count(*)::int FROM treido.users) AS users,(SELECT count(*)::int FROM treido.seller_accounts) AS sellers",
          )
        ).rows[0];
      const before = await count();
      const empty = await readLibrary(get().database, actor, { view: "saved" });
      expect(empty).toMatchObject({ revision: 0, savedCount: 0, items: [] });
      expect(await count()).toEqual(before);
      await change(actor, {
        kind: "save",
        listingId: fixture.draft.id,
        saved: true,
      });
      const fresh = get().fresh();
      try {
        const view = await readLibrary(fresh, actor, { view: "saved" });
        expect(view.items).toHaveLength(1);
        expect(view.items[0]).toMatchObject({
          id: fixture.draft.id,
          card: { title: "Телефон за тест", seller: { id: fixture.sellerId } },
          collectionIds: [],
        });
        expect(view.savedIds).toEqual([fixture.draft.id]);
      } finally {
        await fresh.pool.end();
      }
      expect((await count()).sellers).toBe(before.sellers);
      expect(
        (await readLibrary(get().database, identity(), { view: "saved" }))
          .items,
      ).toEqual([]);
    });
    it("creates, renames and organizes private collections atomically without losing saves on deletion", async () => {
      const actor = identity();
      const created = await change(actor, {
        kind: "createCollection",
        name: "  Подаръци  ",
        listingId: fixture.draft.id,
      });
      const collectionId = created.resultId!;
      const view = await readLibrary(get().database, actor, {
        view: "saved",
        collectionId,
        pickerId: fixture.draft.id,
      });
      expect(view.collections[0]).toMatchObject({
        id: collectionId,
        name: "Подаръци",
        count: 1,
        contains: true,
      });
      expect(view.collections[0].covers[0]).toMatch(/^\/api\/listing-media\//);
      expect(view.items[0].collectionIds).toEqual([collectionId]);
      await change(actor, {
        kind: "renameCollection",
        collectionId,
        name: "Birthday",
      });
      await change(actor, {
        kind: "collectionItem",
        collectionId,
        listingId: fixture.draft.id,
        included: false,
      });
      expect(
        (
          await readLibrary(get().database, actor, {
            view: "saved",
            collectionId,
          })
        ).items,
      ).toEqual([]);
      expect(
        (await readLibrary(get().database, actor, { view: "saved" }))
          .savedCount,
      ).toBe(1);
      await change(actor, {
        kind: "collectionItem",
        collectionId,
        listingId: fixture.draft.id,
        included: true,
      });
      await change(actor, { kind: "deleteCollection", collectionId });
      const deleted = await readLibrary(get().database, actor, {
        view: "saved",
      });
      expect(deleted.collections).toEqual([]);
      expect(deleted.savedIds).toEqual([fixture.draft.id]);
      expect(deleted.items[0].collectionIds).toEqual([]);
      await expect(
        readLibrary(get().database, actor, { view: "saved", collectionId }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("serializes duplicate requests and rejects stale-device writes or old replays after unsaving", async () => {
      const actor = identity();
      const input = await command(actor, {
        kind: "save",
        listingId: fixture.draft.id,
        saved: true,
      });
      const [a, b] = await Promise.all([
        changeLibrary(get().database, actor, input),
        changeLibrary(get().database, actor, input),
      ]);
      expect(a).toEqual(b);
      expect(a.revision).toBe(1);
      const stale = await command(actor, {
        kind: "follow",
        sellerId: fixture.sellerId,
        followed: true,
      });
      const collectionId = (
        await change(actor, {
          kind: "createCollection",
          name: "Retry",
          listingId: fixture.draft.id,
        })
      ).resultId!;
      await change(actor, {
        kind: "save",
        listingId: fixture.draft.id,
        saved: false,
      });
      await expect(
        changeLibrary(get().database, actor, input),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        changeLibrary(get().database, actor, stale),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const view = await readLibrary(get().database, actor, {
        view: "saved",
        pickerId: fixture.draft.id,
      });
      expect(view.savedCount).toBe(0);
      expect(
        view.collections.find((row) => row.id === collectionId),
      ).toMatchObject({ count: 0, contains: false, covers: [] });
    });
    it("isolates collections and actor fingerprints and rolls back an unavailable create-and-save", async () => {
      const actor = identity(),
        other = identity();
      const collectionId = (
        await change(actor, { kind: "createCollection", name: "Private" })
      ).resultId!;
      await expect(
        change(other, {
          kind: "renameCollection",
          collectionId,
          name: "Stolen",
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        change(other, {
          kind: "collectionItem",
          collectionId,
          listingId: fixture.draft.id,
          included: true,
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      const wrongActor = await command(actor, {
        kind: "save",
        listingId: fixture.draft.id,
        saved: true,
      });
      await expect(
        changeLibrary(get().database, other, wrongActor),
      ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
      const before = await readLibrary(get().database, actor, {});
      await expect(
        change(actor, {
          kind: "createCollection",
          name: "Must roll back",
          listingId: randomUUID(),
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      const after = await readLibrary(get().database, actor, {});
      expect(after.revision).toBe(before.revision);
      expect(after.collections).toEqual(before.collections);
      expect(
        (await readLibrary(get().database, other, { view: "saved" }))
          .savedCount,
      ).toBe(0);
    });
    it("paginates owned unavailable bookmarks at tied microsecond timestamps without omissions", async () => {
      const actor = identity();
      await change(actor, { kind: "createCollection", name: "Page fixture" });
      const userId = (
        await get().admin.query(
          "SELECT id FROM treido.users WHERE clerk_subject=$1",
          [actor.subject],
        )
      ).rows[0].id;
      const ids: string[] = [];
      // Fixture-only historical bookmarks. The production command never accepts unpublished inventory.
      for (let index = 0; index < 27; index++) {
        const draft = await createListingDraft(get().database, get().owner, {
          sellerId: fixture.sellerId,
          requestId: randomUUID(),
          payload: {
            ...emptyDraft,
            title: "Private pagination fixture " + index,
          },
        });
        ids.push(draft.id);
        await get().admin.query(
          "INSERT INTO treido.saved_listings(user_id,listing_id,saved_at) VALUES($1,$2,'2026-10-03T00:00:00.123456Z')",
          [userId, draft.id],
        );
      }
      const first = await readLibrary(get().database, actor, { view: "saved" });
      expect(first.total).toBe(27);
      expect(first.items).toHaveLength(24);
      const second = await readLibrary(get().database, actor, {
        view: "saved",
        cursor: first.nextCursor,
      });
      expect(second.items).toHaveLength(3);
      expect(second.nextCursor).toBeNull();
      expect([...first.items, ...second.items].map((row) => row.id)).toEqual(
        ids.sort().reverse(),
      );
      expect(
        [...first.items, ...second.items].every((row) => row.card === null),
      ).toBe(true);
      await expect(
        readLibrary(get().database, identity(), {
          view: "saved",
          cursor: first.nextCursor,
        }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    });
    it("enforces runtime ownership columns, append-only receipts and restricted-account checks", async () => {
      const actor = identity();
      const input = await command(actor, {
        kind: "save",
        listingId: fixture.draft.id,
        saved: true,
      });
      await changeLibrary(get().database, actor, input);
      await expect(
        get().database.pool.query(
          "UPDATE treido.saved_listings SET user_id=user_id",
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        get().database.pool.query(
          "UPDATE treido.buyer_library_receipts SET accepted_revision=accepted_revision",
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await get().admin.query(
        "UPDATE treido.users SET status='restricted' WHERE clerk_subject=$1",
        [actor.subject],
      );
      await expect(
        readLibrary(get().database, actor, { view: "saved" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        changeLibrary(get().database, actor, input),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it.skipIf(process.env.TREIDO_LIBRARY_BROWSER !== "1")(
      "uses real Shop buyer controls, collection sheets and account persistence in the browser",
      async () => {
        const { runLibraryBrowser } =
          await import("../../../../../tests/library-flow-browser.mjs");
        await runLibraryBrowser({
          database: get().database,
          fixture,
          identity: identity(),
          api: {
            readLibrary,
            changeLibrary,
            readPublishedListing,
            readPublishedPhoto,
            readPublicDiscovery,
            readPublicSeller,
            readDiscoveryInput,
          },
        });
      },
      90000,
    );
    it("retains truthful withdrawn bookmarks and follows without disclosing later private edits", async () => {
      const actor = identity();
      const collectionId = (
        await change(actor, {
          kind: "createCollection",
          name: "History",
          listingId: fixture.draft.id,
        })
      ).resultId!;
      await change(actor, {
        kind: "follow",
        sellerId: fixture.sellerId,
        followed: true,
      });
      const fresh = get().fresh();
      try {
        expect(
          (await readLibrary(fresh, actor, { view: "following" })).follows[0]
            .seller?.id,
        ).toBe(fixture.sellerId);
      } finally {
        await fresh.pool.end();
      }
      await withdrawListing(get().database, get().owner, {
        sellerId: fixture.sellerId,
        listingId: fixture.draft.id,
        expectedRevision: publicationRevision,
        requestId: randomUUID(),
      });
      const draft = await readListingDraft(
        get().database,
        get().owner,
        fixture.sellerId,
        fixture.draft.id,
      );
      await saveListingDraft(get().database, get().owner, {
        sellerId: fixture.sellerId,
        draftId: fixture.draft.id,
        expectedRevision: draft.revision,
        requestId: randomUUID(),
        payload: { ...draft.payload, title: "PRIVATE AFTER WITHDRAWAL" },
      });
      const saved = await readLibrary(get().database, actor, {
        view: "saved",
        pickerId: fixture.draft.id,
      });
      expect(saved.items[0]).toEqual({
        id: fixture.draft.id,
        card: null,
        collectionIds: [collectionId],
      });
      expect(saved.collections[0]).toMatchObject({
        contains: true,
        covers: [],
        count: 1,
      });
      expect(JSON.stringify(saved)).not.toMatch(
        /PRIVATE AFTER|Телефон|PRIVATE TEST ADDRESS|private@example/,
      );
      const follows = await readLibrary(get().database, actor, {
        view: "following",
      });
      expect(follows.follows).toEqual([{ id: fixture.sellerId, seller: null }]);
      await expect(
        change(identity(), {
          kind: "save",
          listingId: fixture.draft.id,
          saved: true,
        }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await change(actor, {
        kind: "collectionItem",
        collectionId,
        listingId: fixture.draft.id,
        included: false,
      });
      await change(actor, {
        kind: "save",
        listingId: fixture.draft.id,
        saved: false,
      });
      await change(actor, {
        kind: "follow",
        sellerId: fixture.sellerId,
        followed: false,
      });
      expect(
        (await readLibrary(get().database, actor, { view: "saved" }))
          .savedCount,
      ).toBe(0);
      expect(
        (await readLibrary(get().database, actor, { view: "following" }))
          .followingCount,
      ).toBe(0);
    });
  });
}
