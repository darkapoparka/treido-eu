import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { PublicationFixtureContext } from "../../../tests/fixtures/publication-flow";
import { createPublicationFixture } from "../../../tests/fixtures/publication-flow";
import {
  createBusinessSeller,
  ensurePersonalSeller,
  readSellerContext,
  revokeSellerMembership,
} from "../sellers/persistence.server";
import {
  readPersonalProfile,
  savePersonalProfile,
} from "./personal-profile.server";
import { createListingDraft, readListingDraft } from "../selling/drafts.server";
import { emptyDraft } from "../selling/draft-model";
import { publishListing } from "../selling/publish.server";
import { readPublicSeller } from "../catalog/public-discovery.server";
import { duplicateSellerProducts } from "../sellers/admin-product-management.server";
import {
  acceptInvitation,
  changeTeam,
  readIncomingInvitations,
  readTeam,
} from "../team/persistence.server";
import { declineInvitation } from "../team/decisions.server";

export function defineLaunchIntegrationCases(
  get: () => PublicationFixtureContext,
) {
  const person = () => {
    const id = randomUUID().replaceAll("-", "");
    return {
      subject: "user_launch_" + id,
      verifiedEmails: [id + "@example.test"],
    };
  };
  async function invite() {
    const ctx = get(),
      recipient = person();
    const sellerId = await createBusinessSeller(ctx.database, ctx.owner, {
      name: "Invitation decision fixture",
      requestId: randomUUID(),
    });
    const team = await readTeam(ctx.database, ctx.owner, sellerId);
    const result = await changeTeam(ctx.database, ctx.owner, {
      kind: "invite",
      sellerId,
      expectedRevision: team.revision,
      requestId: randomUUID(),
      recipient: recipient.verifiedEmails[0],
      language: "bg",
      access: { role: "member", grants: ["seller.read"] },
    });
    return { sellerId, recipient, invitationId: result.invitations[0].id };
  }
  describe("recipient decisions, personal seller profiles and multi-product copies", () => {
    beforeAll(async () => {
      await get().admin.query(
        "UPDATE treido.category_policies SET state='reviewed',enabled_for_publish=true,review_reference='SYNTHETIC T44 NATIVE TEST ONLY',reviewed_at=now() WHERE category_id='cat:electronics/phones' AND version=1",
      );
    });
    afterAll(async () => {
      await get().admin.query(
        "UPDATE treido.category_policies SET state='pending',enabled_for_publish=false,review_reference=NULL,reviewed_at=NULL WHERE category_id='cat:electronics/phones' AND version=1",
      );
    });
    it("declines only for the intended verified human, frees the seat and replays without joining", async () => {
      const ctx = get(),
        item = await invite();
      await expect(
        declineInvitation(ctx.database, person(), item.invitationId),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(
        await readIncomingInvitations(ctx.database, item.recipient),
      ).toMatchObject([{ canAccept: true, canDecline: true, canOpen: false }]);
      const result = await declineInvitation(
        ctx.database,
        item.recipient,
        item.invitationId,
      );
      expect(
        await declineInvitation(
          ctx.database,
          item.recipient,
          item.invitationId,
        ),
      ).toEqual(result);
      expect(
        await readIncomingInvitations(ctx.database, item.recipient),
      ).toMatchObject([
        {
          status: "declined",
          canAccept: false,
          canDecline: false,
          canOpen: false,
        },
      ]);
      expect(
        await readTeam(ctx.database, ctx.owner, item.sellerId),
      ).toMatchObject({ usedSeats: 1, reservedSeats: 0 });
      await expect(
        acceptInvitation(ctx.database, item.recipient, item.invitationId),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        readSellerContext(ctx.database, item.recipient, item.sellerId),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      const sameEmail = {
        ...person(),
        verifiedEmails: item.recipient.verifiedEmails,
      };
      await expect(
        declineInvitation(ctx.database, sameEmail, item.invitationId),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("serializes accept versus decline and removes Open business after revocation", async () => {
      const ctx = get(),
        item = await invite();
      const race = await Promise.allSettled([
        acceptInvitation(ctx.database, item.recipient, item.invitationId),
        declineInvitation(ctx.database, item.recipient, item.invitationId),
      ]);
      expect(
        race.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      const incoming = (
        await readIncomingInvitations(ctx.database, item.recipient)
      )[0];
      expect(["accepted", "declined"]).toContain(incoming.status);
      if (incoming.status === "accepted") {
        expect(incoming.canOpen).toBe(true);
        const user = (
          await ctx.admin.query(
            "SELECT id FROM treido.users WHERE clerk_subject=$1",
            [item.recipient.subject],
          )
        ).rows[0];
        await revokeSellerMembership(ctx.database, ctx.owner, {
          sellerId: item.sellerId,
          userId: user.id,
        });
        expect(
          (await readIncomingInvitations(ctx.database, item.recipient))[0]
            .canOpen,
        ).toBe(false);
      } else expect(incoming.canOpen).toBe(false);
    });
    it("saves personal public fields with durable receipts and current ownership without business onboarding", async () => {
      const ctx = get(),
        owner = person(),
        sellerId = await ensurePersonalSeller(ctx.database, owner);
      const initial = await readPersonalProfile(ctx.database, owner, sellerId);
      const command = {
        sellerId,
        expectedRevision: initial.revision,
        requestId: randomUUID(),
        profile: {
          name: "  Лични находки  ",
          description: "Авторско описание",
          locality: "София",
        },
      };
      const result = await savePersonalProfile(ctx.database, owner, command);
      expect(result.profile.name).toBe("Лични находки");
      expect(await savePersonalProfile(ctx.database, owner, command)).toEqual(
        result,
      );
      expect(await readPersonalProfile(ctx.database, owner, sellerId)).toEqual(
        result,
      );
      await expect(
        savePersonalProfile(ctx.database, owner, {
          ...command,
          requestId: randomUUID(),
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        savePersonalProfile(ctx.database, ctx.owner, command),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        savePersonalProfile(ctx.database, owner, {
          ...command,
          profile: { ...command.profile, name: "Changed" },
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        (
          await ctx.admin.query(
            "SELECT count(*)::int AS n FROM treido.seller_onboarding_progress WHERE seller_id=$1",
            [sellerId],
          )
        ).rows[0].n,
      ).toBe(0);
      await expect(
        ctx.database.pool.query(
          "UPDATE treido.personal_profile_receipts SET accepted_revision=99",
        ),
      ).rejects.toMatchObject({ code: "42501" });
      expect(await readPublicSeller(ctx.database, sellerId)).toBeNull();
    });
    it("shows saved personal profile facts on the real eligible public seller projection", async () => {
      const ctx = { ...get(), owner: person() };
      const fixture = await createPublicationFixture(ctx, "personal");
      const initial = await readPersonalProfile(
        ctx.database,
        ctx.owner,
        fixture.sellerId,
      );
      await savePersonalProfile(ctx.database, ctx.owner, {
        sellerId: fixture.sellerId,
        expectedRevision: initial.revision,
        requestId: randomUUID(),
        profile: {
          name: "Софийски находки",
          description: "Само мои лични вещи",
          locality: "София",
        },
      });
      await publishListing(ctx.database, ctx.owner, fixture.input);
      const publicSeller = await readPublicSeller(
        ctx.database,
        fixture.sellerId,
      );
      expect(publicSeller?.name).toBe("Софийски находки");
      expect(JSON.stringify(publicSeller)).toContain("Само мои лични вещи");
      expect(JSON.stringify(publicSeller)).toContain("София");
    });
    it("copies selected products once, keeps originals unchanged and reports a foreign row independently", async () => {
      const ctx = get(),
        sellerId = await createBusinessSeller(ctx.database, ctx.owner, {
          name: "Bulk copy fixture",
          requestId: randomUUID(),
        });
      const sources = await Promise.all(
        ["First item", "Second item"].map((title) =>
          createListingDraft(ctx.database, ctx.owner, {
            sellerId,
            requestId: randomUUID(),
            payload: {
              ...emptyDraft,
              categoryId: "cat:electronics/phones",
              title,
              condition: "good",
            },
          }),
        ),
      );
      const input = {
        sellerId,
        items: sources.map((draft) => ({
          listingId: draft.id,
          expectedRevision: draft.revision,
          requestId: randomUUID(),
        })),
      };
      const copied = await duplicateSellerProducts(
        ctx.database,
        ctx.owner,
        input,
      );
      expect(copied.every((row) => row.result.ok)).toBe(true);
      expect(
        await duplicateSellerProducts(ctx.database, ctx.owner, input),
      ).toEqual(copied);
      expect(
        (
          await ctx.admin.query(
            "SELECT count(*)::int AS n FROM treido.listings WHERE seller_id=$1",
            [sellerId],
          )
        ).rows[0].n,
      ).toBe(4);
      for (const row of copied) {
        if (!row.result.ok) throw new Error("Expected copy");
        expect(
          (
            await readListingDraft(
              ctx.database,
              ctx.owner,
              sellerId,
              row.result.data.id,
            )
          ).payload.condition,
        ).toBe("");
      }
      const partial = await duplicateSellerProducts(ctx.database, ctx.owner, {
        sellerId,
        items: [
          { ...input.items[0], requestId: randomUUID() },
          {
            listingId: randomUUID(),
            expectedRevision: 1,
            requestId: randomUUID(),
          },
        ],
      });
      expect(partial[0].result.ok).toBe(true);
      expect(partial[1].result).toEqual({ ok: false, code: "FORBIDDEN" });
      expect(
        (
          await readListingDraft(
            ctx.database,
            ctx.owner,
            sellerId,
            sources[0].id,
          )
        ).payload.condition,
      ).toBe("good");
    });
  });
}
