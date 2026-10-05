/** New source only. Adopt in the ORIGINAL grants transaction after source ACK. */
export async function applyShippingRetentionGrants(client, role) {
  if (!/^[a-z][a-z0-9_]{1,62}$/.test(role))
    throw new Error("Invalid runtime role.");
  const quoted = '"' + role + '"';
  const table = "order_shipping_retention_approvals";
  await client.query("REVOKE ALL ON treido." + table + " FROM " + quoted);
  const columns = (
    await client.query(
      "SELECT attname FROM pg_attribute WHERE attrelid=$1::regclass AND attnum>0 AND NOT attisdropped ORDER BY attnum",
      ["treido." + table],
    )
  ).rows
    .map((row) => {
      if (!/^[a-z][a-z0-9_]*$/.test(row.attname))
        throw new Error("Invalid retention column.");
      return '"' + row.attname + '"';
    })
    .join(",");
  if (columns)
    await client.query(
      "REVOKE SELECT (" +
        columns +
        "),INSERT (" +
        columns +
        "),UPDATE (" +
        columns +
        "),REFERENCES (" +
        columns +
        ") ON treido." +
        table +
        " FROM " +
        quoted,
    );
  await client.query("GRANT SELECT ON treido." + table + " TO " + quoted);
  await client.query(
    "GRANT EXECUTE ON FUNCTION treido.order_shipping_validate_recipient_job(uuid,uuid,uuid,integer,uuid,text,text,text,text,text),treido.order_shipping_clear_accepted_recipient(uuid,uuid,uuid,integer,uuid,text,text,text,text,text),treido.order_shipping_recipient_obligations_clear(uuid) TO " +
      quoted,
  );
  // No policy writes, private recipient UPDATE, predicate/hash/trigger grants.
}
