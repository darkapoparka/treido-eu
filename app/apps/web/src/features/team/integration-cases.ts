import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createDatabase, inTransaction } from "../../server/db/database";
import {
  authorizeSeller,
  createBusinessSeller,
  readSellerContext,
  revokeSellerMembership,
} from "../sellers/persistence.server";
import { readCatalogueImports } from "../catalogue-import/queries.server";
import {
  readServiceSettings,
  saveServiceSettings,
} from "../seller-settings/persistence.server";
import {
  emptyContact,
  emptyDelivery,
  publicServiceSettings,
} from "../seller-settings/model";
import { readPublicSeller } from "../catalog/public-discovery.server";
import type { PublicationFixtureContext } from "../../../tests/fixtures/publication-flow";
import {
  readTeam,
  changeTeam,
  readIncomingInvitations,
  acceptInvitation,
  type VerifiedRecipientIdentity,
} from "./persistence.server";
import { expireTeamInvitations } from "./expiry.server";
import type { TeamCommand, TeamAccess } from "./model";

export function defineTeamIntegrationCases(
  get: () => PublicationFixtureContext,
) {
  describe("durable business teams and independent service settings", () => {
    const person = (): VerifiedRecipientIdentity => {
      const id = randomUUID().replaceAll("-", "");
      return {
        subject: "user_team_" + id,
        verifiedEmails: [id + "@example.test"],
      };
    };
    const fresh = () =>
      createBusinessSeller(get().database, get().owner, {
        name: "Team integration business",
        requestId: randomUUID(),
      });
    const invite = async (
      sellerId: string,
      recipient: VerifiedRecipientIdentity,
      access: TeamAccess = { role: "member", grants: ["seller.read"] },
      actor = get().owner,
    ) => {
      const view = await readTeam(get().database, actor, sellerId);
      const command: TeamCommand = {
        sellerId,
        requestId: randomUUID(),
        expectedRevision: view.revision,
        kind: "invite",
        recipient: recipient.verifiedEmails[0],
        access,
        language: "en",
      };
      const result = await changeTeam(get().database, actor, command);
      return {
        command,
        view: result,
        id: result.invitations.find(
          (i) => i.recipient === recipient.verifiedEmails[0],
        )!.id,
      };
    };
    it("persists recipient-specific invitation and delivery together; reads do not create a human or membership", async () => {
      const ctx = get(),
        sellerId = await fresh(),
        recipient = person(),
        wrong = person();
      const invitation = await invite(sellerId, recipient);
      expect(invitation.view).toMatchObject({
        usedSeats: 1,
        reservedSeats: 1,
        seats: 3,
      });
      expect(
        await changeTeam(ctx.database, ctx.owner, invitation.command),
      ).toEqual(invitation.view);
      expect(
        await readIncomingInvitations(ctx.database, recipient),
      ).toMatchObject([
        { id: invitation.id, canAccept: true, status: "pending" },
      ]);
      expect(
        (
          await ctx.admin.query(
            "SELECT count(*)::int AS n FROM treido.users WHERE clerk_subject=$1",
            [recipient.subject],
          )
        ).rows[0].n,
      ).toBe(0);
      expect(await readIncomingInvitations(ctx.database, wrong)).toEqual([]);
      await expect(
        acceptInvitation(ctx.database, wrong, invitation.id),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(
        (
          await ctx.admin.query(
            "SELECT count(*)::int AS n FROM treido.users WHERE clerk_subject=$1",
            [wrong.subject],
          )
        ).rows[0].n,
      ).toBe(0);
      const delivery = (
        await ctx.admin.query(
          "SELECT d.state,j.kind,j.authority FROM treido.invitation_deliveries d JOIN treido.outbox_jobs j ON j.resource_id=d.id WHERE d.invitation_id=$1",
          [invitation.id],
        )
      ).rows;
      expect(delivery).toEqual([
        { state: "pending", kind: "team.invitation", authority: "member" },
      ]);
      const accepted = await acceptInvitation(
        ctx.database,
        recipient,
        invitation.id,
      );
      expect(
        await acceptInvitation(ctx.database, recipient, invitation.id),
      ).toEqual(accepted);
      expect(
        await readSellerContext(ctx.database, recipient, sellerId),
      ).toMatchObject({ sellerId, kind: "business" });
      expect(await readTeam(ctx.database, ctx.owner, sellerId)).toMatchObject({
        usedSeats: 2,
        reservedSeats: 0,
      });
      const freshDb = createDatabase(new Pool(ctx.database.pool.options));
      try {
        expect(
          (await readIncomingInvitations(freshDb, recipient))[0].status,
        ).toBe("accepted");
      } finally {
        await freshDb.pool.end();
      }
    });
    it("serializes competing seat reservations and retries without oversubscription", async () => {
      const ctx = get(),
        sellerId = await fresh();
      await invite(sellerId, person());
      const revision = (await readTeam(ctx.database, ctx.owner, sellerId))
        .revision;
      const commands = Array.from({ length: 2 }, (): TeamCommand => ({
        sellerId,
        requestId: randomUUID(),
        expectedRevision: revision,
        kind: "invite",
        recipient: person().verifiedEmails[0],
        access: { role: "member", grants: ["seller.read"] },
        language: "bg",
      }));
      const results = await Promise.allSettled(
        commands.map((c) => changeTeam(ctx.database, ctx.owner, c)),
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await readTeam(ctx.database, ctx.owner, sellerId)).toMatchObject({
        usedSeats: 1,
        reservedSeats: 2,
      });
      await expect(invite(sellerId, person())).rejects.toMatchObject({
        code: "QUOTA_EXCEEDED",
      });
    });
    it("cancels and expires invitations durably, freeing capacity and preventing old acceptance", async () => {
      const ctx = get(),
        sellerId = await fresh(),
        recipient = person();
      let invitation = await invite(sellerId, recipient);
      const cancel: TeamCommand = {
        kind: "cancel",
        sellerId,
        invitationId: invitation.id,
        expectedRevision: invitation.view.revision,
        requestId: randomUUID(),
      };
      const result = await changeTeam(ctx.database, ctx.owner, cancel);
      expect(result.reservedSeats).toBe(0);
      expect(result.invitations[0]).toMatchObject({
        status: "cancelled",
        delivery: "cancelled",
      });
      expect(await changeTeam(ctx.database, ctx.owner, cancel)).toEqual(result);
      await expect(
        acceptInvitation(ctx.database, recipient, invitation.id),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      invitation = await invite(sellerId, recipient);
      await ctx.admin.query(
        "UPDATE treido.seller_invitations SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
        [invitation.id],
      );
      expect(
        (await readTeam(ctx.database, ctx.owner, sellerId)).reservedSeats,
      ).toBe(0);
      expect(
        (await expireTeamInvitations(ctx.database)).expired,
      ).toBeGreaterThan(0);
      await expect(
        acceptInvitation(ctx.database, recipient, invitation.id),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        (
          await ctx.admin.query(
            "SELECT status FROM treido.seller_invitations WHERE id=$1",
            [invitation.id],
          )
        ).rows[0].status,
      ).toBe("expired");
    });
    it("limits delegation to current capabilities and refuses manager changes to an owner", async () => {
      const ctx = get(),
        sellerId = await fresh(),
        manager = person();
      const ownInvitation = await invite(sellerId, manager, {
        role: "manager",
        grants: ["seller.read", "team.manage"],
      });
      await acceptInvitation(ctx.database, manager, ownInvitation.id);
      await expect(
        invite(
          sellerId,
          person(),
          { role: "member", grants: ["seller.read", "billing.manage"] },
          manager,
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      const pending = await invite(
        sellerId,
        person(),
        { role: "member", grants: ["seller.read", "listing.read"] },
        manager,
      );
      const ownerMember = pending.view.members.find((m) => m.role === "owner")!;
      await expect(
        changeTeam(ctx.database, manager, {
          kind: "revoke",
          sellerId,
          userId: ownerMember.userId,
          expectedRevision: pending.view.revision,
          requestId: randomUUID(),
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      const managed = pending.view.members.find((m) => m.self)!;
      await revokeSellerMembership(ctx.database, ctx.owner, {
        sellerId,
        userId: managed.userId,
      });
      expect(
        (await readTeam(ctx.database, ctx.owner, sellerId)).invitations.find(
          (i) => i.id === pending.id,
        )?.status,
      ).toBe("cancelled");
      await expect(
        changeTeam(ctx.database, manager, pending.command),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        acceptInvitation(ctx.database, manager, ownInvitation.id),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      for (const capability of [
        "seller.read",
        "listing.read",
        "listing.write",
        "inventory.manage",
        "import.run",
        "inbox.read",
        "inbox.reply",
        "order.read",
        "team.manage",
      ] as const)
        await expect(
          inTransaction(ctx.database, (tx) =>
            authorizeSeller(tx, manager, sellerId, capability),
          ),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        readCatalogueImports(ctx.database, manager, { sellerId }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("keeps businesses separate, protects the last owner and does not replay a changed membership", async () => {
      const ctx = get(),
        a = await fresh(),
        b = await fresh(),
        recipient = person();
      const first = await invite(a, recipient, {
          role: "manager",
          grants: ["seller.read", "team.manage"],
        }),
        second = await invite(b, recipient);
      await acceptInvitation(ctx.database, recipient, first.id);
      await acceptInvitation(ctx.database, recipient, second.id);
      let view = await readTeam(ctx.database, ctx.owner, a);
      const member = view.members.find((m) => m.role === "manager")!;
      await changeTeam(ctx.database, ctx.owner, {
        kind: "change",
        sellerId: a,
        userId: member.userId,
        access: { role: "member", grants: ["seller.read"] },
        expectedRevision: view.revision,
        requestId: randomUUID(),
      });
      await expect(
        acceptInvitation(ctx.database, recipient, first.id),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      view = await readTeam(ctx.database, ctx.owner, a);
      await changeTeam(ctx.database, ctx.owner, {
        kind: "revoke",
        sellerId: a,
        userId: member.userId,
        expectedRevision: view.revision,
        requestId: randomUUID(),
      });
      expect(await readSellerContext(ctx.database, recipient, b)).toMatchObject(
        { sellerId: b },
      );
      const owner = view.members.find((m) => m.role === "owner")!;
      await expect(
        revokeSellerMembership(ctx.database, ctx.owner, {
          sellerId: a,
          userId: owner.userId,
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
    it("saves contact and delivery with independent revisions and immutable replay receipts", async () => {
      const ctx = get(),
        sellerId = await fresh();
      const contact = {
        sellerId,
        section: "contact" as const,
        expectedRevision: 0,
        requestId: randomUUID(),
        payload: {
          ...emptyContact,
          published: true,
          publicEmail: "Public@Example.test",
          contactNote: "Call before collection.",
        },
      };
      const delivery = {
        sellerId,
        section: "delivery" as const,
        expectedRevision: 0,
        requestId: randomUUID(),
        payload: {
          ...emptyDelivery,
          published: true,
          pickup: true,
          pickupArea: "София",
          pickupNote: "Уговорка в чата",
        },
      };
      const [c, d] = await Promise.all([
        saveServiceSettings(ctx.database, ctx.owner, contact),
        saveServiceSettings(ctx.database, ctx.owner, delivery),
      ]);
      expect(c.revision).toBe(1);
      expect(d.revision).toBe(1);
      expect(
        await saveServiceSettings(ctx.database, ctx.owner, contact),
      ).toEqual(c);
      expect(
        await readServiceSettings(
          ctx.database,
          ctx.owner,
          sellerId,
          "delivery",
        ),
      ).toEqual(d);
      expect(publicServiceSettings(c.payload, d.payload)).toMatchObject({
        contact: { publicEmail: "public@example.test" },
        delivery: { pickupArea: "София" },
      });
      expect(await readPublicSeller(ctx.database, sellerId)).toBeNull();
      await expect(
        saveServiceSettings(ctx.database, ctx.owner, {
          ...contact,
          requestId: randomUUID(),
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const next = await saveServiceSettings(ctx.database, ctx.owner, {
        ...contact,
        expectedRevision: 1,
        requestId: randomUUID(),
        payload: { ...contact.payload, published: false },
      });
      expect(publicServiceSettings(next.payload, d.payload).contact).toBeNull();
      await expect(
        saveServiceSettings(ctx.database, ctx.owner, contact),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        ctx.database.pool.query(
          "UPDATE treido.seller_service_receipts SET accepted_revision=99",
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        ctx.database.pool.query(
          "UPDATE treido.seller_invitations SET recipient=recipient",
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        ctx.database.pool.query(
          "UPDATE treido.team_command_receipts SET input_hash=input_hash",
        ),
      ).rejects.toMatchObject({ code: "42501" });
    });
    it("enforces separate contact and delivery permissions and removes them immediately on revocation", async () => {
      const ctx = get(),
        sellerId = await fresh(),
        recipient = person();
      const invitation = await invite(sellerId, recipient, {
        role: "member",
        grants: ["seller.read", "profile.manage"],
      });
      await acceptInvitation(ctx.database, recipient, invitation.id);
      expect(
        (
          await readServiceSettings(
            ctx.database,
            recipient,
            sellerId,
            "contact",
          )
        ).revision,
      ).toBe(0);
      await expect(
        readServiceSettings(ctx.database, recipient, sellerId, "delivery"),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      const input = {
        sellerId,
        section: "contact" as const,
        expectedRevision: 0,
        requestId: randomUUID(),
        payload: emptyContact,
      };
      await saveServiceSettings(ctx.database, recipient, input);
      const user = (
        await ctx.admin.query(
          "SELECT id FROM treido.users WHERE clerk_subject=$1",
          [recipient.subject],
        )
      ).rows[0].id;
      await revokeSellerMembership(ctx.database, ctx.owner, {
        sellerId,
        userId: user,
      });
      await expect(
        saveServiceSettings(ctx.database, recipient, input),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        readServiceSettings(ctx.database, recipient, sellerId, "contact"),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });
}
