/** T50 integration fragment; call at the END of the reviewed runtime grant runner.
 * This module has no executable entrypoint and grants no operator authority. */
export async function applyTrustCaseGrants(client, role) {
  if (!/^[a-z][a-z0-9_]{1,62}$/.test(role))
    throw new Error("Invalid runtime role.");
  const name = `"${role}"`;
  await client.query(`REVOKE ALL ON treido.trust_case_decisions,treido.message_moderation_actions FROM PUBLIC;
    REVOKE UPDATE,DELETE,TRUNCATE ON treido.trust_case_decisions,treido.message_moderation_actions FROM ${name};
    GRANT SELECT,INSERT ON treido.trust_case_decisions,treido.message_moderation_actions TO ${name};
    REVOKE UPDATE,DELETE,TRUNCATE ON treido.reports FROM ${name};
    GRANT UPDATE(state,revision) ON treido.reports TO ${name}`);
}
