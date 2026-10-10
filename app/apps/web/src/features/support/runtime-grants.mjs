export async function applySupportGrants(client, role) {
  if (!/^[a-z][a-z0-9_]{1,62}$/.test(role)) throw new Error("Invalid runtime role.");
  const name = `"${role}"`;
  const exists = await client.query("SELECT to_regclass('treido.support_tickets') IS NOT NULL AS ready");
  if (!exists.rows[0]?.ready) return;
  await client.query(`REVOKE UPDATE,DELETE ON treido.support_tickets,treido.support_entries,treido.support_command_receipts,treido.support_read_cursors,treido.support_notifications FROM ${name};
    GRANT UPDATE(state,revision,last_sequence,public_sequence,updated_at) ON treido.support_tickets TO ${name};
    GRANT UPDATE(sequence) ON treido.support_read_cursors TO ${name}`);
}
