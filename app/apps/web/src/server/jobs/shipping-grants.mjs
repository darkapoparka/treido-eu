/** Called only by the ORIGINAL restricted grants transaction. No approval write. */
export async function applyShippingIntegrationGrants(client, role) {
  if (!/^[a-z][a-z0-9_]{1,62}$/.test(role))
    throw new Error("Invalid runtime role.");
  const quoted = '"' + role + '"';
  for (const table of [
    "order_refund_shipping_components",
    "order_shipping_integration_qualifications",
  ]) {
    await client.query("REVOKE ALL ON treido." + table + " FROM " + quoted);
    const columns = (
      await client.query(
        "SELECT attname FROM pg_attribute WHERE attrelid=$1::regclass AND attnum>0 AND NOT attisdropped ORDER BY attnum",
        ["treido." + table],
      )
    ).rows
      .map((row) => {
        if (!/^[a-z][a-z0-9_]*$/.test(row.attname))
          throw new Error("Invalid shipping column.");
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
  }
  await client.query(
    "GRANT SELECT,INSERT ON treido.order_refund_shipping_components TO " +
      quoted,
  );
  await client.query(
    "GRANT SELECT ON treido.order_shipping_integration_qualifications TO " +
      quoted,
  );
  await client.query(
    "GRANT EXECUTE ON FUNCTION treido.order_shipping_retention_ready(uuid,text,text),treido.order_shipping_quote_ready(uuid,text,text),treido.order_shipping_authorize_job(uuid,uuid,uuid,text,integer,uuid,text,text,text,text,text),treido.order_shipping_enqueue_maintenance(integer),treido.order_shipping_closure_facts(uuid) TO " +
      quoted,
  );
}
