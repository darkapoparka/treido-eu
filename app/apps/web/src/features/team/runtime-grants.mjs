/** Parent calls this in its existing reviewed migration/grant transaction. */
export async function applyInvitationMailGrants(client, role) {
  if (!/^[a-z][a-z0-9_]{1,62}$/.test(role))
    throw new Error("Invalid runtime role.");
  await client.query(
    `GRANT UPDATE(state,provider_id,request_payload,first_attempt_at,submitted_at,mail_binding,provider_key,observed_at,last_checked_at) ON treido.invitation_deliveries TO "${role}"`,
  );
}
