import { createHash } from "node:crypto";

/** Reviewed SQL and its receipt commit together on the supplied migration client. */
export async function applyIdentityDraftMigration(client, source) {
  return applyReviewedMigration(client, "0001_identity_drafts", source);
}

export async function applyReviewedMigration(client, version, source) {
  if (!/^\d{4}_[a-z_]+$/.test(version))
    throw new Error("Invalid migration version.");
  const checksum = createHash("sha256").update(source).digest("hex");
  await client.query("BEGIN");
  try {
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('treido:migrations', 0))",
    );
    await client.query(`CREATE TABLE IF NOT EXISTS public.treido_schema_migrations (
      version text PRIMARY KEY, checksum varchar(64) NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const previous = await client.query(
      "SELECT checksum FROM public.treido_schema_migrations WHERE version = $1",
      [version],
    );
    if (previous.rows[0] && previous.rows[0].checksum !== checksum)
      throw new Error(
        "Applied migration checksum differs. Create a new migration.",
      );
    if (!previous.rows.length) {
      await client.query(source);
      await client.query(
        "INSERT INTO public.treido_schema_migrations(version, checksum) VALUES($1, $2)",
        [version, checksum],
      );
    }
    await client.query("COMMIT");
    return previous.rows.length ? "already-applied" : "applied";
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
