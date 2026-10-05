export async function applyMessageImageLifecycleGrants(client, role) {
  if (
    !/^[a-z][a-z0-9_]{1,62}$/.test(role) ||
    ["postgres", "public"].includes(role)
  )
    throw Error("Invalid runtime role");
  const r = '"' + role + '"';
  await client.query(
    `REVOKE ALL ON treido.message_image_lifecycle_policies,treido.message_image_legal_holds,treido.message_image_tombstones FROM ${r}`,
  );
  await client.query(`GRANT SELECT ON treido.message_image_tombstones TO ${r}`);
  await client.query(
    `GRANT EXECUTE ON FUNCTION treido.account_message_image_review(uuid,uuid,uuid),treido.account_message_image_io(uuid,uuid),treido.account_message_image_available(uuid,uuid,uuid) TO ${r}`,
  );
}
