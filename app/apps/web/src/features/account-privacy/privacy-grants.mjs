// Unnumbered T55 proposal; called only by the shared owner's reviewed grant transaction.
export async function applyAccountPrivacyGrants(client, role) {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(role))
    throw new Error("Invalid runtime role");
  const recipient = '"' + role + '"';
  const tables = [
    "account_privacy_workspaces",
    "account_privacy_exports",
    "account_privacy_reviews",
    "account_closure_requests",
    "account_privacy_receipts",
  ];
  for (const table of tables) {
    await client.query(
      `REVOKE ALL ON treido.${table} FROM PUBLIC, ${recipient}`,
    );
    await client.query(
      `GRANT SELECT, INSERT ON treido.${table} TO ${recipient}`,
    );
  }
  await client.query(
    `GRANT UPDATE(revision) ON treido.account_privacy_workspaces TO ${recipient}`,
  );
  await client.query(
    `GRANT UPDATE(state,revision,updated_at) ON treido.account_closure_requests TO ${recipient}`,
  );
  // Only disposable download artifacts. No source account, message, media, order or legal evidence deletion.
  await client.query(
    `GRANT DELETE ON treido.account_privacy_exports TO ${recipient}`,
  );
}
