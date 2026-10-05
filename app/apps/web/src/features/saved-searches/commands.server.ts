import "server-only";
import { randomUUID } from "node:crypto";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { authorizeHuman, inputHash } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import {
  criteriaIntent,
  parseSearchCommand,
  SEARCH_LIMITS,
  type SearchChange,
  type Criteria,
} from "./model";
import {
  requireSearchStorage,
  searchActorKey,
  searchColumns,
  searchFrom,
  type SearchRow,
} from "./storage.server";
import { startSearchRun } from "./runs.server";
async function version(
  tx: SellerTransaction,
  userId: string,
  searchId: string,
  next: number,
  criteria: Criteria,
) {
  await tx.client.query(
    "INSERT INTO treido.buyer_saved_search_versions(user_id,search_id,version,criteria) VALUES($1,$2,$3,$4::jsonb)",
    [userId, searchId, next, JSON.stringify(criteria)],
  );
}
export async function changeSavedSearch(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  raw: unknown,
): Promise<SearchChange> {
  const input = parseSearchCommand(raw, true);
  if (input.actorKey !== searchActorKey(identity))
    throw new SellerError("UNAUTHENTICATED");
  return inTransaction(database, async (tx) => {
    await requireSearchStorage(tx);
    const user = await authorizeHuman(
      tx,
      identity,
      input.operation.kind === "save",
    );
    await tx.client.query(
      "INSERT INTO treido.buyer_saved_search_workspaces(user_id) VALUES($1) ON CONFLICT DO NOTHING",
      [user.id],
    );
    const current = (
      await tx.client.query<{ revision: number }>(
        "SELECT revision FROM treido.buyer_saved_search_workspaces WHERE user_id=$1 FOR UPDATE",
        [user.id],
      )
    ).rows[0];
    const hash = inputHash(input);
    const receipt = (
      await tx.client.query<{
        hash: string;
        revision: number;
        searchId: string | null;
        version: number | null;
      }>(
        `SELECT input_hash AS hash,accepted_revision AS revision,search_id AS "searchId",criteria_version AS version FROM treido.buyer_saved_search_receipts WHERE user_id=$1 AND request_id=$2`,
        [user.id, input.requestId],
      )
    ).rows[0];
    if (receipt) {
      if (receipt.hash !== hash) throw new SellerError("CONFLICT");
      return {
        revision: receipt.revision,
        searchId: receipt.searchId,
        version: receipt.version,
        replayed: true,
      };
    }
    // Replay of a genuine historical registry version is acknowledged first.
    // A new command must still validate every criterion against current policy.
    if (inputHash(parseSearchCommand(input)) !== hash)
      throw new SellerError("INVALID_INPUT");
    if (current.revision !== input.expectedRevision)
      throw new SellerError("CONFLICT");
    const rate = (
      await tx.client.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM treido.buyer_saved_search_receipts WHERE user_id=$1 AND created_at>clock_timestamp()-interval '1 minute'",
        [user.id],
      )
    ).rows[0].count;
    if (rate >= SEARCH_LIMITS.commandsPerMinute)
      throw new SellerError("QUOTA_EXCEEDED");
    const op = input.operation;
    let searchId: string | null = null,
      acceptedVersion: number | null = null;
    if (op.kind === "save") {
      const count = (
        await tx.client.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM treido.buyer_saved_searches WHERE user_id=$1 AND status<>'removed'",
          [user.id],
        )
      ).rows[0].count;
      if (count >= SEARCH_LIMITS.searches)
        throw new SellerError("QUOTA_EXCEEDED");
      searchId = randomUUID();
      acceptedVersion = 1;
      await tx.client.query(
        `INSERT INTO treido.buyer_saved_searches(id,user_id,name,status,criteria_version,frequency_minutes,consent_at,due_at)
        VALUES($1,$2,$3,$4,1,$5,CASE WHEN $6 THEN clock_timestamp() END,CASE WHEN $6 THEN clock_timestamp() END)`,
        [
          searchId,
          user.id,
          op.name,
          op.enable ? "enabled" : "paused",
          op.frequency,
          op.enable,
        ],
      );
      await version(tx, user.id, searchId, 1, op.criteria);
    } else if (op.kind === "read") {
      const rows = (
        await tx.client.query<{ id: string }>(
          `SELECT n.id FROM treido.buyer_search_notifications n JOIN treido.buyer_saved_searches s ON s.user_id=n.user_id AND s.id=n.search_id
        WHERE n.user_id=$1 AND n.id=ANY($2::uuid[]) AND s.status<>'removed'`,
          [user.id, op.notificationIds],
        )
      ).rows;
      if (rows.length !== op.notificationIds.length)
        throw new SellerError("NOT_FOUND");
      await tx.client.query(
        "UPDATE treido.buyer_search_notifications SET read_at=coalesce(read_at,clock_timestamp()) WHERE user_id=$1 AND id=ANY($2::uuid[])",
        [user.id, op.notificationIds],
      );
    } else {
      searchId = op.searchId;
      const search = (
        await tx.client.query<SearchRow>(
          `SELECT ${searchColumns} ${searchFrom} WHERE s.user_id=$1 AND s.id=$2 AND s.status<>'removed' FOR UPDATE OF s`,
          [user.id, searchId],
        )
      ).rows[0];
      if (!search) throw new SellerError("NOT_FOUND");
      acceptedVersion = search.version;
      if (
        ["criteria", "enable", "pause", "remove"].includes(op.kind) &&
        search.generation >= 2147483646
      )
        throw new SellerError("CONFLICT");
      if (op.kind === "rename")
        await tx.client.query(
          "UPDATE treido.buyer_saved_searches SET name=$3 WHERE user_id=$1 AND id=$2",
          [user.id, searchId, op.name],
        );
      else if (op.kind === "criteria") {
        if (search.version >= 2147483646 || search.generation >= 2147483646)
          throw new SellerError("CONFLICT");
        acceptedVersion = search.version + 1;
        await version(tx, user.id, searchId, acceptedVersion, op.criteria);
        await tx.client.query(
          "UPDATE treido.buyer_saved_searches SET criteria_version=$3,consent_generation=consent_generation+1,last_check_at=NULL,due_at=CASE WHEN status='enabled' THEN clock_timestamp() END WHERE user_id=$1 AND id=$2",
          [user.id, searchId, acceptedVersion],
        );
        await tx.client.query(
          "UPDATE treido.buyer_saved_search_runs SET state='cancelled' WHERE user_id=$1 AND search_id=$2 AND state='running'",
          [user.id, searchId],
        );
        await tx.client.query(
          "DELETE FROM treido.buyer_saved_search_versions WHERE user_id=$1 AND search_id=$2 AND version<>$3",
          [user.id, searchId, acceptedVersion],
        );
        await tx.client.query(
          "DELETE FROM treido.buyer_search_observations WHERE user_id=$1 AND search_id=$2",
          [user.id, searchId],
        );
      } else if (op.kind === "enable") {
        if (!criteriaIntent(search.criteria))
          throw new SellerError("INVALID_INPUT");
        await tx.client.query(
          "UPDATE treido.buyer_saved_searches SET status='enabled',consent_generation=consent_generation+1,consent_at=clock_timestamp(),frequency_minutes=$3,due_at=clock_timestamp() WHERE user_id=$1 AND id=$2",
          [user.id, searchId, op.frequency],
        );
        await tx.client.query(
          "UPDATE treido.buyer_saved_search_runs SET state='cancelled' WHERE user_id=$1 AND search_id=$2 AND state='running'",
          [user.id, searchId],
        );
      } else if (op.kind === "pause" || op.kind === "remove") {
        await tx.client.query(
          `UPDATE treido.buyer_saved_searches SET status=$3,consent_generation=consent_generation+1,consent_at=NULL,due_at=NULL,
          name=CASE WHEN $3='removed' THEN NULL ELSE name END,last_check_at=CASE WHEN $3='removed' THEN NULL ELSE last_check_at END WHERE user_id=$1 AND id=$2`,
          [user.id, searchId, op.kind === "pause" ? "paused" : "removed"],
        );
        await tx.client.query(
          "UPDATE treido.buyer_saved_search_runs SET state='cancelled' WHERE user_id=$1 AND search_id=$2 AND state='running'",
          [user.id, searchId],
        );
        if (op.kind === "remove") {
          for (const table of [
            "buyer_search_notifications",
            "buyer_search_observations",
            "buyer_saved_search_runs",
            "buyer_saved_search_versions",
          ])
            await tx.client.query(
              `DELETE FROM treido.${table} WHERE user_id=$1 AND search_id=$2`,
              [user.id, searchId],
            );
        }
      } else if (op.kind === "check") {
        if (!criteriaIntent(search.criteria))
          throw new SellerError("INVALID_INPUT");
        await startSearchRun(tx, search, true);
      }
    }
    if (op.kind === "save" || op.kind === "criteria" || op.kind === "enable") {
      const search = (
        await tx.client.query<SearchRow>(
          `SELECT ${searchColumns} ${searchFrom} WHERE s.user_id=$1 AND s.id=$2`,
          [user.id, searchId],
        )
      ).rows[0];
      if (search.status === "enabled") await startSearchRun(tx, search);
    }
    const revision = current.revision + 1;
    await tx.client.query(
      "UPDATE treido.buyer_saved_search_workspaces SET revision=$2 WHERE user_id=$1",
      [user.id, revision],
    );
    await tx.client.query(
      "INSERT INTO treido.buyer_saved_search_receipts(user_id,request_id,input_hash,accepted_revision,search_id,criteria_version) VALUES($1,$2,$3,$4,$5,$6)",
      [user.id, input.requestId, hash, revision, searchId, acceptedVersion],
    );
    return { revision, searchId, version: acceptedVersion, replayed: false };
  });
}
