/** Invoked only by the original canonical grant transaction. */
export async function applyLifecycleJobGrants(client, role) {
  if (!/^[a-z][a-z0-9_]{1,62}$/.test(role))
    throw new Error("Invalid runtime role.");
  const r = '"' + role + '"';
  for (const signature of [
    "account_enqueue_closure(uuid)",
    "account_repair_closure(integer)",
    "assistant_enqueue_maintenance(integer)",
  ]) {
    await client.query(
      "REVOKE ALL ON FUNCTION treido." + signature + " FROM PUBLIC",
    );
    await client.query(
      "GRANT EXECUTE ON FUNCTION treido." + signature + " TO " + r,
    );
  }
  const repair = await client.query(
    "SELECT to_regprocedure('treido.repair_any_due_v1()') IS NOT NULL AS ready",
  );
  if (repair.rows[0]?.ready) {
    await client.query(
      "REVOKE ALL ON FUNCTION treido.repair_any_due_v1() FROM PUBLIC",
    );
    await client.query(
      "GRANT EXECUTE ON FUNCTION treido.repair_any_due_v1() TO " + r,
    );
  }
  // Queue primitive, hash/trigger and private assistant mutations are never granted.
}
