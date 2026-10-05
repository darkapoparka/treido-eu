import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { createDatabase, inTransaction, type SellerDatabase } from "../../apps/web/src/server/db/database";
import type { VerifiedIdentity } from "../../apps/web/src/server/identity/clerk.server";
import { authorizeHuman } from "../../apps/web/src/features/sellers/persistence.server";
import { changePrivacy } from "../../apps/web/src/features/account-privacy/commands.server";
import { projectExport } from "../../apps/web/src/features/account-privacy/projections.server";
import { privacyActorKey } from "../../apps/web/src/features/account-privacy/storage.server";
import type { PersonalSnapshot } from "../../apps/web/src/features/account-privacy/model";

export type PartialExportContext = { database: SellerDatabase; admin: Pool; registerRecent: (identity: VerifiedIdentity) => void };
export type OptionalExportNamespace = "gift" | "compatibility";
const namespaces = {
  gift: ["buyer_gift_workspaces", "buyer_gift_observations", "buyer_gift_receipts"],
  compatibility: ["buyer_compatibility_workspaces", "buyer_compatibility_observations", "buyer_compatibility_receipts"],
} as const;

/** No projection/command/authority query is mocked. A single disposable admin
 * connection lets test-only DDL live INSIDE the ORIGINAL command transaction.
 * After its real isolation statement, rename exact allowlisted relations and
 * SET LOCAL ROLE treido_runtime. All feature queries execute in that role.
 * The transport intercepts only final COMMIT: capture the real inserted row,
 * then ROLLBACK instead, preserving every original relation and source row.
 * Failed commands execute their ORIGINAL ROLLBACK. This is rollback-only local
 * transaction fault injection, not a shared database or persistence proof.
 */
export async function createPartialExportFixture(context: PartialExportContext, namespace: OptionalExportNamespace, present: 0 | 1 | 2 | 3) {
  const { admin, database } = context;
  const actualDatabase = (await admin.query<{ name: string }>("SELECT current_database() AS name")).rows[0].name;
  if (actualDatabase !== "t61_isolated") throw Error("Optional namespace DDL requires original owned disposable t61_isolated database");
  const identities = [0, 1].map(() => ({ subject: "user_t61_partial_export_" + randomUUID().replaceAll("-", "") }));
  for (const identity of identities) context.registerRecent(identity);
  const users = await Promise.all(identities.map(identity => inTransaction(database, tx => authorizeHuman(tx, identity, true))));
  for (const user of users) {
    await database.pool.query("INSERT INTO treido.buyer_gift_workspaces(user_id) VALUES($1)", [user.id]);
    await database.pool.query("INSERT INTO treido.buyer_compatibility_workspaces(user_id,requirements) VALUES($1,$2::jsonb)", [user.id, JSON.stringify({ version: 1, query: "T61 OWN ROLLBACK ONLY " + user.id })]);
  }
  const owner = users[0], identity = identities[0], requestId = randomUUID();
  const command = { version: 1, actorKey: privacyActorKey(identity), requestId, expectedRevision: 0,
    operation: { kind: "export", categories: ["searches"] } };
  const relations = [...namespaces.gift, ...namespaces.compatibility];
  const originalRelations = (await database.pool.query("SELECT name,to_regclass('treido.'||name)::oid AS oid FROM unnest($1::text[]) name ORDER BY name", [relations])).rows;
  if (originalRelations.some(row => row.oid === null)) throw Error("Final native bootstrap must contain both complete original namespaces");
  const state = async () => (await database.pool.query(`SELECT
    (SELECT count(*)::int FROM treido.account_privacy_exports WHERE user_id=$1) AS exports,
    (SELECT count(*)::int FROM treido.account_privacy_receipts WHERE user_id=$1) AS receipts,
    (SELECT revision FROM treido.account_privacy_workspaces WHERE user_id=$1) AS revision`, [owner.id])).rows[0];
  const before = await state();
  async function run() {
    const client = await admin.connect();
    const delegate = client.query.bind(client);
    const hidden: string[] = [];
    let faultApplied = false, rolledBack = false;
    let runtime: { name: string; superuser: boolean; bypass: boolean } | undefined;
    let snapshot: PersonalSnapshot | undefined;
    let projection: Awaited<ReturnType<typeof projectExport>> | undefined;
    let projectionFailure: unknown;
    let commandFailure: unknown;
    let acknowledgment: Awaited<ReturnType<typeof changePrivacy>> | undefined;
    const query = (async (text: unknown, ...args: unknown[]) => {
      if (text === "COMMIT") {
        const rows = await delegate<{ snapshot: PersonalSnapshot }>("SELECT snapshot FROM treido.account_privacy_exports WHERE user_id=$1", [owner.id]);
        if (rows.rows.length !== 1) throw Error("Original command must insert exactly one actual snapshot before rollback");
        snapshot = rows.rows[0].snapshot;
        const result = await delegate("ROLLBACK"); rolledBack = true; return result;
      }
      const result = await Reflect.apply(client.query, client, [text, ...args]);
      if (text === "ROLLBACK") rolledBack = true;
      if (text === "SET TRANSACTION ISOLATION LEVEL REPEATABLE READ") {
        if (faultApplied) throw Error("Original command attempted duplicate fixture transaction");
        faultApplied = true;
        for (const name of namespaces[namespace].slice(present)) {
          // Only these six constant identifiers can enter DDL; generated suffix
          // is bounded hex. No cascade, drop, grant or migration modification.
          const replacement = "t61_hidden_" + randomUUID().replaceAll("-", "");
          await delegate(`ALTER TABLE treido.${name} RENAME TO ${replacement}`);
          hidden.push(name);
        }
        await delegate("SET LOCAL ROLE treido_runtime");
        runtime = (await delegate<{ name: string; superuser: boolean; bypass: boolean }>("SELECT current_user AS name,rolsuper AS superuser,rolbypassrls AS bypass FROM pg_roles WHERE rolname=current_user")).rows[0];
        if (runtime.name !== "treido_runtime" || runtime.superuser || runtime.bypass) throw Error("Actual original projection/command must run as restricted treido_runtime");
        try { projection = await projectExport(client, owner.id, ["searches"]); }
        catch (error) { projectionFailure = error; }
      }
      return result;
    }) as PoolClient["query"];
    const wrapped = new Proxy(client, { get(target, key) {
      if (key === "query") return query;
      if (key === "release") return () => undefined;
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    } });
    const rollbackPool: Pool = Object.create(database.pool);
    Object.defineProperty(rollbackPool, "connect", { value: async () => wrapped });
    try {
      try { acknowledgment = await changePrivacy(createDatabase(rollbackPool), identity, command); }
      catch (error) { commandFailure = error; }
      if (!faultApplied || !rolledBack) throw Error("Original command must reach actual fixture transaction and rollback");
    } finally { await delegate("ROLLBACK"); client.release(); }
    const restored = (await database.pool.query("SELECT name,to_regclass('treido.'||name)::oid AS oid FROM unnest($1::text[]) name ORDER BY name", [relations])).rows;
    return { runtime, hidden, snapshot, projection, projectionFailure, commandFailure, acknowledgment, before, after: await state(), originalRelations, restored };
  }
  return { run, ownerId: owner.id, foreignId: users[1].id, present, namespace };
}
