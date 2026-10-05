/** Original proposal only; T64's reviewed grant transaction owns adoption. */
export async function applyOrderShippingGrants(client, role) {
  if (!/^[a-z][a-z0-9_]{1,62}$/.test(role))
    throw new Error("Invalid runtime role.");
  const quoted = '"' + role + '"';
  const tables = [
    "order_shipping_policies",
    "order_shipping_carriers",
    "order_shipping_rates",
    "order_shipping_choices",
    "order_shipping_recipients",
    "order_shipping_receipts",
  ];
  for (const table of tables) {
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
    "GRANT SELECT ON treido.order_shipping_policies,treido.order_shipping_carriers,treido.order_shipping_rates TO " +
      quoted,
  );
  await client.query(
    "GRANT UPDATE(id) ON treido.order_shipping_policies,treido.order_shipping_carriers,treido.order_shipping_rates TO " +
      quoted,
  );
  await client.query(
    "GRANT SELECT,INSERT ON treido.order_shipping_choices,treido.order_shipping_recipients,treido.order_shipping_receipts TO " +
      quoted,
  );
  await client.query(
    "GRANT UPDATE(state,revision,accepted_at,bound_at,quote_id) ON treido.order_shipping_choices TO " +
      quoted,
  );
  await client.query(
    "GRANT UPDATE(retain_until) ON treido.order_shipping_recipients TO " +
      quoted,
  );
  await client.query(
    "GRANT EXECUTE ON FUNCTION treido.shipping_localized(jsonb),treido.order_shipping_input_intent_hash(uuid,uuid),treido.order_shipping_expire_input(uuid,uuid,uuid,integer,uuid,text,text,text,text,text) TO " +
      quoted,
  );
}
