import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import type { SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import {
  createBusinessSeller,
  ensurePersonalSeller,
  revokeSellerMembership,
} from "./persistence.server";
import {
  createListingDraft,
  readListingDraft,
  saveListingDraft,
} from "../selling/drafts.server";
import { emptyDraft } from "../selling/draft-model";
import { FREE_DRAFT_LIMITS } from "../selling/draft-quota";
import {
  duplicateSellerProduct,
  withdrawSellerProducts,
} from "./admin-product-management.server";
type Context = {
  database: SellerDatabase;
  admin: Client;
  owner: VerifiedIdentity;
  other: VerifiedIdentity;
};
export function defineProductManagementIntegrationCases(get: () => Context) {
  const input = (
    sellerId: string,
    listingId: string,
    expectedRevision = 1,
  ) => ({ sellerId, listingId, expectedRevision, requestId: randomUUID() });
  async function fixture() {
    const { database, owner } = get();
    const sellerId = await createBusinessSeller(database, owner, {
      name: "Product management",
      requestId: randomUUID(),
    });
    const source = await createListingDraft(database, owner, {
      sellerId,
      requestId: randomUUID(),
      payload: {
        ...emptyDraft,
        title: "Телефон за копиране",
        description: "Saved product description",
        categoryId: "cat:electronics/phones",
        condition: "good",
        priceMinor: 2495,
        locality: "София",
      },
    });
    return { sellerId, source, command: input(sellerId, source.id) };
  }
  async function grant(sellerId: string, grants: string[]) {
    const { database, admin, other } = get();
    await ensurePersonalSeller(database, other);
    const userId = (
      await admin.query("SELECT id FROM treido.users WHERE clerk_subject=$1", [
        other.subject,
      ])
    ).rows[0].id as string;
    await admin.query(
      "INSERT INTO treido.seller_memberships(seller_id,user_id,role,grants) VALUES($1,$2,'member',$3::jsonb) ON CONFLICT(seller_id,user_id) DO UPDATE SET grants=excluded.grants,status='active'",
      [sellerId, userId, JSON.stringify(grants)],
    );
    return userId;
  }
  describe("real product management transactions", () => {
    it("duplicates saved content into an owned incomplete draft without publishing or altering the source", async () => {
      const { database, admin, owner } = get();
      const { sellerId, source, command } = await fixture();
      await admin.query(
        "UPDATE treido.listings SET publication='published' WHERE id=$1",
        [source.id],
      );
      const saved = await readListingDraft(
        database,
        owner,
        sellerId,
        source.id,
      );
      const copy = await duplicateSellerProduct(database, owner, command);
      expect(copy.id).not.toBe(source.id);
      expect(copy).toMatchObject({ sellerId, revision: 1 });
      expect(
        (await readListingDraft(database, owner, sellerId, copy.id)).payload,
      ).toEqual({ ...saved.payload, condition: "" });
      expect(
        await readListingDraft(database, owner, sellerId, source.id),
      ).toEqual(saved);
      expect(
        (
          await admin.query(
            "SELECT publication,moderation_state FROM treido.listings WHERE id=$1",
            [copy.id],
          )
        ).rows[0],
      ).toEqual({ publication: "draft", moderation_state: "clear" });
      expect(
        (
          await admin.query(
            "SELECT count(*)::int AS count FROM treido.media_assets WHERE listing_id=$1",
            [copy.id],
          )
        ).rows[0].count,
      ).toBe(0);
      expect(
        (
          await admin.query(
            "SELECT draft_count FROM treido.seller_usage WHERE seller_id=$1",
            [sellerId],
          )
        ).rows[0].draft_count,
      ).toBe(2);
    });
    it("creates once on concurrent retry and returns the same copy after later source/copy edits", async () => {
      const { database, admin, owner } = get();
      const { sellerId, source, command } = await fixture();
      const [one, two] = await Promise.all([
        duplicateSellerProduct(database, owner, command),
        duplicateSellerProduct(database, owner, command),
      ]);
      expect(one.id).toBe(two.id);
      expect(
        (
          await admin.query(
            "SELECT count(*)::int AS count FROM treido.listing_duplicate_receipts WHERE seller_id=$1",
            [sellerId],
          )
        ).rows[0].count,
      ).toBe(1);
      for (const id of [source.id, one.id]) {
        const draft = await readListingDraft(database, owner, sellerId, id);
        await saveListingDraft(database, owner, {
          sellerId,
          draftId: id,
          requestId: randomUUID(),
          expectedRevision: 1,
          payload: { ...draft.payload, title: "Edited later" },
        });
      }
      const replay = await duplicateSellerProduct(database, owner, command);
      expect(replay).toMatchObject({ id: one.id, revision: 2 });
      expect(
        (await readListingDraft(database, owner, sellerId, one.id)).payload
          .title,
      ).toBe("Edited later");
    });
    it("rejects stale revisions and a retry key reused for another source or revision", async () => {
      const { database, owner } = get();
      const { sellerId, source, command } = await fixture();
      await expect(
        duplicateSellerProduct(database, owner, {
          ...command,
          expectedRevision: 9,
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const copy = await duplicateSellerProduct(database, owner, command);
      await expect(
        duplicateSellerProduct(database, owner, {
          ...command,
          listingId: copy.id,
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        duplicateSellerProduct(database, owner, {
          ...command,
          expectedRevision: 2,
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        (await readListingDraft(database, owner, sellerId, source.id)).revision,
      ).toBe(1);
    });
    it("denies foreign, read-only, revoked and restricted duplication including replay", async () => {
      const { database, admin, owner, other } = get();
      const { sellerId, source, command } = await fixture();
      await expect(
        duplicateSellerProduct(database, other, command),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await grant(sellerId, ["listing.read"]);
      await expect(
        duplicateSellerProduct(database, other, command),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      const userId = await grant(sellerId, ["listing.read", "listing.write"]);
      await duplicateSellerProduct(database, other, command);
      await revokeSellerMembership(database, owner, { sellerId, userId });
      await expect(
        duplicateSellerProduct(database, other, command),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await admin.query(
        "UPDATE treido.listings SET moderation_state='restricted' WHERE id=$1",
        [source.id],
      );
      await expect(
        duplicateSellerProduct(database, owner, command),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      const foreign = await fixture();
      await expect(
        duplicateSellerProduct(database, owner, {
          ...foreign.command,
          listingId: source.id,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("allows only one final draft slot across two authorized humans", async () => {
      const { database, admin, owner, other } = get();
      const { sellerId, source } = await fixture();
      await grant(sellerId, ["listing.read", "listing.write"]);
      await admin.query(
        "UPDATE treido.seller_usage SET draft_count=$2 WHERE seller_id=$1",
        [sellerId, FREE_DRAFT_LIMITS.business - 1],
      );
      const results = await Promise.allSettled([
        duplicateSellerProduct(database, owner, input(sellerId, source.id)),
        duplicateSellerProduct(database, other, input(sellerId, source.id)),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      const rejected = results.find((result) => result.status === "rejected");
      expect(
        rejected?.status === "rejected" ? rejected.reason : null,
      ).toMatchObject({ code: "QUOTA_EXCEEDED" });
      expect(
        (
          await admin.query(
            "SELECT draft_count FROM treido.seller_usage WHERE seller_id=$1",
            [sellerId],
          )
        ).rows[0].draft_count,
      ).toBe(FREE_DRAFT_LIMITS.business);
    });
    it("keeps receipts immutable for runtime and prevents cross-seller result references", async () => {
      const { database, admin, owner } = get();
      const one = await fixture(),
        otherSeller = await fixture();
      await duplicateSellerProduct(database, owner, one.command);
      await expect(
        database.pool.query(
          "UPDATE treido.listing_duplicate_receipts SET input_hash=input_hash WHERE seller_id=$1",
          [one.sellerId],
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        database.pool.query(
          "DELETE FROM treido.listing_duplicate_receipts WHERE seller_id=$1",
          [one.sellerId],
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        admin.query(
          "UPDATE treido.listing_duplicate_receipts SET new_listing_id=$2 WHERE seller_id=$1",
          [one.sellerId, otherSeller.source.id],
        ),
      ).rejects.toMatchObject({ code: "23503" });
    });
    it("withdraws only explicit eligible rows, reports partial results and retries once", async () => {
      const { database, admin, owner } = get();
      const one = await fixture(),
        foreign = await fixture();
      const stale = await createListingDraft(database, owner, {
        sellerId: one.sellerId,
        requestId: randomUUID(),
        payload: emptyDraft,
      });
      const draft = await createListingDraft(database, owner, {
        sellerId: one.sellerId,
        requestId: randomUUID(),
        payload: emptyDraft,
      });
      await admin.query(
        "UPDATE treido.listings SET publication='published' WHERE id=ANY($1::uuid[])",
        [[one.source.id, stale.id]],
      );
      const items = [
        input(one.sellerId, one.source.id),
        input(one.sellerId, stale.id, 9),
        input(one.sellerId, draft.id),
        input(one.sellerId, foreign.source.id),
      ].map(({ listingId, expectedRevision, requestId }) => ({
        listingId,
        expectedRevision,
        requestId,
      }));
      const command = { sellerId: one.sellerId, items };
      const result = await withdrawSellerProducts(database, owner, command);
      expect(result.map((row) => row.result)).toEqual([
        { ok: true, revision: 2 },
        { ok: false, code: "CONFLICT" },
        { ok: false, code: "CONFLICT" },
        { ok: false, code: "FORBIDDEN" },
      ]);
      expect(await withdrawSellerProducts(database, owner, command)).toEqual(
        result,
      );
      expect(
        (
          await admin.query(
            "SELECT count(*)::int AS count FROM treido.listing_withdrawal_receipts WHERE seller_id=$1",
            [one.sellerId],
          )
        ).rows[0].count,
      ).toBe(1);
      expect(
        (await readListingDraft(database, owner, one.sellerId, one.source.id))
          .payload.priceMinor,
      ).toBe(2495);
      expect(
        (
          await admin.query(
            "SELECT publication FROM treido.listings WHERE id=$1",
            [stale.id],
          )
        ).rows[0].publication,
      ).toBe("published");
    });
    it("rejects implicit or oversized batches before changing any row", async () => {
      const { database, admin, owner } = get();
      const { sellerId, source } = await fixture();
      await admin.query(
        "UPDATE treido.listings SET publication='published' WHERE id=$1",
        [source.id],
      );
      await expect(
        withdrawSellerProducts(database, owner, { sellerId, selectAll: true }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
      await expect(
        withdrawSellerProducts(database, owner, {
          sellerId,
          items: Array.from({ length: 31 }, () => input(sellerId, source.id)),
        }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
      expect(
        (
          await admin.query(
            "SELECT publication FROM treido.listings WHERE id=$1",
            [source.id],
          )
        ).rows[0].publication,
      ).toBe("published");
    });
  });
}
