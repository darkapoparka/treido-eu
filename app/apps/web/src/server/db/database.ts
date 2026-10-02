import "server-only";
import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { requireBackendBindings } from "../config/backend-bindings.server";
import * as schema from "./schema";

export function createDatabase(pool: Pool) {
  return { pool, db: drizzle(pool, { schema }) };
}
export type SellerDatabase = ReturnType<typeof createDatabase>;
export type SellerTransaction = {
  client: import("pg").PoolClient;
  db: NodePgDatabase<typeof schema>;
};

let current: SellerDatabase | undefined;
export function getDatabase(): SellerDatabase {
  requireBackendBindings();
  if (!current) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      statement_timeout: 10000,
      idle_in_transaction_session_timeout: 10000,
      application_name: "treido-web",
    });
    pool.on("error", () =>
      console.error("Treido database connection unavailable."),
    );
    current = createDatabase(pool);
  }
  return current;
}

export async function inTransaction<T>(
  database: SellerDatabase,
  work: (tx: SellerTransaction) => Promise<T>,
): Promise<T> {
  const client = await database.pool.connect();
  let discard = false;
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    const result = await work({ client, db: drizzle(client, { schema }) });
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      discard = true;
    }
    throw error;
  } finally {
    client.release(discard);
  }
}
