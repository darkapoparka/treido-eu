export async function applyAftercareClosureGrants(client, role) {
  if (!/^[a-z][a-z0-9_]{1,62}$/.test(role))
    throw new Error("Invalid runtime role.");
  const quoted = '"' + role + '"';
  await client.query(
    "REVOKE ALL ON treido.order_aftercare_lifecycle_policies,treido.order_aftercare_legal_holds FROM " +
      quoted,
  );
  await client.query(
    "GRANT SELECT ON treido.order_aftercare_lifecycle_policies,treido.order_aftercare_legal_holds TO " +
      quoted,
  );
  await client.query(
    "GRANT EXECUTE ON FUNCTION treido.order_aftercare_closure_facts(uuid),treido.account_closure_extension_facts(uuid),treido.assistant_input_closure_facts(uuid),treido.account_closure_assistant_targets(uuid,text,text) TO " +
      quoted,
  );
}
