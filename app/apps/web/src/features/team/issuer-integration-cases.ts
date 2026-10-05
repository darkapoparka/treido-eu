import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  createBusinessSeller,
  readSellerContext,
} from "../sellers/persistence.server";
import {
  acceptInvitation,
  changeTeam,
  readTeam,
  type VerifiedRecipientIdentity,
} from "./persistence.server";
import type { TeamAccess } from "./model";
import {
  createLifecycleActor,
  createLifecycleRegistry,
  createLifecyclePlan,
  type LifecycleNativeContext,
} from "../../../../../tests/t61/lifecycle-fixture";
import { changeClosure } from "../account-closure/commands.server";
import { actorKey } from "../account-closure/storage.server";
import { processClosureJob } from "../account-closure/jobs.server";
import { executeJob } from "../../server/jobs/execution.server";
import {
  jobColumns,
  type ClosureJobRow,
} from "../../server/jobs/outbox.server";

export function defineIssuerConsistencyCases(
  get: () => LifecycleNativeContext,
) {
  const person = (): VerifiedRecipientIdentity => ({
    subject: "user_t71_" + randomUUID().replaceAll("-", ""),
    verifiedEmails: [randomUUID() + "@example.test"],
  });
  const prepare = async () => {
    const context = get(),
      owner = await createLifecycleActor(context),
      issuer = await createLifecycleActor(context);
    const sellerId = await createBusinessSeller(
      context.database,
      owner.identity,
      { name: "Isolated issuer business", requestId: randomUUID() },
    );
    const manager: VerifiedRecipientIdentity = {
      ...issuer.identity,
      verifiedEmails: [randomUUID() + "@example.test"],
    };
    const invite = async (
      actor: VerifiedRecipientIdentity | typeof owner.identity,
      recipient: VerifiedRecipientIdentity,
      access: TeamAccess,
    ) => {
      const view = await readTeam(context.database, actor, sellerId);
      const result = await changeTeam(context.database, actor, {
        sellerId,
        requestId: randomUUID(),
        expectedRevision: view.revision,
        kind: "invite",
        recipient: recipient.verifiedEmails[0],
        access,
        language: "en",
      });
      return result.invitations.find(
        (i) => i.recipient === recipient.verifiedEmails[0],
      )!.id;
    };
    await acceptInvitation(
      context.database,
      manager,
      await invite(owner.identity, manager, {
        role: "manager",
        grants: ["seller.read", "team.manage", "billing.manage"],
      }),
    );
    const recipient = person();
    const id = await invite(manager, recipient, {
      role: "member",
      grants: ["seller.read", "billing.manage"],
    });
    return { context, owner, issuer, sellerId, recipient, id };
  };
  const noMembership = async (f: Awaited<ReturnType<typeof prepare>>) => {
    expect(
      (
        await f.context.admin.query(
          `SELECT count(*)::int AS n FROM treido.seller_memberships m JOIN treido.users u ON u.id=m.user_id WHERE m.seller_id=$1 AND u.clerk_subject=$2`,
          [f.sellerId, f.recipient.subject],
        )
      ).rows[0].n,
    ).toBe(0);
    expect(
      await readSellerContext(f.context.database, f.owner.identity, f.sellerId),
    ).toMatchObject({ sellerId: f.sellerId });
  };
  describe("T71 current invitation issuer authority", () => {
    it("cancels pending reservations at issuer closure acceptance and denies before/after actual completion", async () => {
      const f = await prepare(),
        rules = await createLifecycleRegistry(f.context),
        plan = await createLifecyclePlan(f.context, f.issuer, rules);
      await changeClosure(f.context.database, f.issuer.identity, {
        version: 1,
        actorKey: actorKey(f.issuer.identity),
        requestId: randomUUID(),
        expectedRevision: 0,
        operation: {
          kind: "confirm",
          planId: plan.id,
          planHash: plan.hash,
          acknowledged: true,
        },
      });
      expect(
        (await readTeam(f.context.database, f.owner.identity, f.sellerId))
          .reservedSeats,
      ).toBe(0);
      await expect(
        acceptInvitation(f.context.database, f.recipient, f.id),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await noMembership(f);
      const job = (
        await f.context.admin.query<ClosureJobRow>(
          `SELECT ${jobColumns} FROM treido.outbox_jobs WHERE kind='account.closure' AND resource_id=$1`,
          [plan.id],
        )
      ).rows[0];
      const namespace = {
        environment: "test",
        applicationId: "treido-t71-isolated",
      };
      await executeJob(
        f.context.database,
        {
          ...namespace,
          schemaVersion: 1,
          jobId: job.id,
          sellerId: null,
          buyerId: job.buyerId,
          generation: job.generation,
        },
        namespace,
        "t71-issuer-close",
        {
          "account.closure": (ctx) =>
            processClosureJob(f.context.database, ctx),
        },
      );
      expect(
        (
          await f.context.admin.query(
            `SELECT status FROM treido.users WHERE id=$1`,
            [f.issuer.userId],
          )
        ).rows[0].status,
      ).toBe("closed");
      await expect(
        acceptInvitation(f.context.database, f.recipient, f.id),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await noMembership(f);
    });
    it.each(["revoked", "demoted", "team.manage", "original-grant"])(
      "denies pending acceptance after issuer %s reduction",
      async (kind) => {
        const f = await prepare();
        if (kind === "revoked")
          await f.context.admin.query(
            `UPDATE treido.seller_memberships SET status='revoked',revision=revision+1 WHERE seller_id=$1 AND user_id=$2`,
            [f.sellerId, f.issuer.userId],
          );
        else if (kind === "demoted")
          await f.context.admin.query(
            `UPDATE treido.seller_memberships SET role='member',grants='["seller.read"]',revision=revision+1 WHERE seller_id=$1 AND user_id=$2`,
            [f.sellerId, f.issuer.userId],
          );
        else
          await f.context.admin.query(
            `UPDATE treido.seller_memberships SET grants=$3::jsonb,revision=revision+1 WHERE seller_id=$1 AND user_id=$2`,
            [
              f.sellerId,
              f.issuer.userId,
              JSON.stringify(
                kind === "team.manage"
                  ? ["seller.read", "billing.manage"]
                  : ["seller.read", "team.manage"],
              ),
            ],
          );
        await expect(
          acceptInvitation(f.context.database, f.recipient, f.id),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        await noMembership(f);
      },
    );
    it("accepts legitimate grants and recovers an accepted receipt after issuer restriction", async () => {
      const f = await prepare();
      const accepted = await acceptInvitation(
        f.context.database,
        f.recipient,
        f.id,
      );
      await f.context.admin.query(
        `UPDATE treido.users SET status='restricted' WHERE id=$1`,
        [f.issuer.userId],
      );
      expect(
        await acceptInvitation(f.context.database, f.recipient, f.id),
      ).toEqual(accepted);
      expect(
        await readSellerContext(
          f.context.database,
          f.owner.identity,
          f.sellerId,
        ),
      ).toMatchObject({ sellerId: f.sellerId });
    });
  });
}
