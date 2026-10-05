import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { changePrivacy } from "./commands.server";
import { readPrivacy, readPrivateDownload } from "./queries.server";
import { privacyActorKey } from "./storage.server";
import type { PrivacyOperation } from "./model";
/** Caller owns a verified disposable PostgreSQL cluster and installs the reviewed unnumbered proposal there.
 * Fixture recent-auth evidence is supplied by the isolated test runner; it is never actual Clerk acceptance.
 * No connection, migration, account closure or provider effect starts by importing this file.
 */
export function definePrivacyIntegrationCases(
  get: () => {
    database: SellerDatabase;
    admin: Pool;
    identities: [VerifiedIdentity, VerifiedIdentity];
    userIds: [string, string];
  },
) {
  describe("personal privacy on isolated PostgreSQL", () => {
    const execute = async (
      operation: PrivacyOperation,
      actor = get().identities[0],
    ) => {
      const view = await readPrivacy(get().database, actor);
      const command = {
        version: 1,
        actorKey: view.actorKey,
        requestId: randomUUID(),
        expectedRevision: view.revision,
        operation,
      };
      return {
        command,
        result: await changePrivacy(get().database, actor, command),
      };
    };
    beforeAll(async () => {
      expect(get().userIds[0]).not.toBe(get().userIds[1]);
      for (const actor of get().identities)
        expect((await readPrivacy(get().database, actor)).actorKey).toBe(
          privacyActorKey(actor),
        );
    });
    it("persists a bounded own snapshot and denies another human's IDs", async () => {
      const { result } = await execute({
        kind: "export",
        categories: ["account", "memberships", "searches"],
      });
      const actor = get().identities[0],
        other = get().identities[1];
      const body = await readPrivateDownload(
        get().database,
        actor,
        result.acknowledgment.resourceId,
        privacyActorKey(actor),
      );
      expect(JSON.parse(body).accountId).toBe(get().userIds[0]);
      expect(body).not.toContain("clerkSubject");
      expect(body).not.toContain(get().userIds[1]);
      await expect(
        readPrivateDownload(
          get().database,
          other,
          result.acknowledgment.resourceId,
          privacyActorKey(other),
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("discard preserves the immutable original receipt without regenerating a snapshot", async () => {
      const { command, result } = await execute({
        kind: "export",
        categories: ["account"],
      });
      await execute({
        kind: "discard",
        exportId: result.acknowledgment.resourceId,
      });
      expect(
        (await changePrivacy(get().database, get().identities[0], command))
          .acknowledgment,
      ).toEqual(result.acknowledgment);
      await expect(
        readPrivateDownload(
          get().database,
          get().identities[0],
          result.acknowledgment.resourceId,
          command.actorKey,
        ),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("a simultaneous same request stores one receipt and can recover serialization uncertainty", async () => {
      const actor = get().identities[0],
        view = await readPrivacy(get().database, actor);
      const command = {
        version: 1,
        actorKey: view.actorKey,
        requestId: randomUUID(),
        expectedRevision: view.revision,
        operation: { kind: "review" },
      };
      const results = await Promise.allSettled([
        changePrivacy(get().database, actor, command),
        changePrivacy(get().database, actor, command),
      ]);
      expect(results.some((result) => result.status === "fulfilled")).toBe(
        true,
      );
      const recovered = await changePrivacy(get().database, actor, command);
      expect(recovered.replayed).toBe(true);
      const count = (
        await get().admin.query(
          "SELECT count(*)::int AS count FROM treido.account_privacy_receipts WHERE user_id=$1 AND request_id=$2",
          [get().userIds[0], command.requestId],
        )
      ).rows[0].count;
      expect(count).toBe(1);
      await expect(
        changePrivacy(get().database, actor, {
          ...command,
          expectedRevision: command.expectedRevision + 1,
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
    it("explicit closure submission and withdrawal never closes/revokes the source account", async () => {
      const { result: review } = await execute({ kind: "review" });
      const { command, result } = await execute({
        kind: "submit",
        reviewId: review.acknowledgment.resourceId,
        acknowledged: true,
      });
      await execute({
        kind: "withdraw",
        closureId: result.acknowledgment.resourceId,
      });
      await expect(
        execute({
          kind: "submit",
          reviewId: review.acknowledgment.resourceId,
          acknowledged: true,
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        (await changePrivacy(get().database, get().identities[0], command))
          .acknowledgment.acceptedState,
      ).toBe("requested");
      const current = await readPrivacy(get().database, get().identities[0]);
      expect(
        current.closures.find(
          (row) => row.id === result.acknowledgment.resourceId,
        )?.state,
      ).toBe("withdrawn");
      expect(
        (
          await get().admin.query(
            "SELECT status FROM treido.users WHERE id=$1",
            [get().userIds[0]],
          )
        ).rows[0].status,
      ).toBe("active");
    });
  });
}
