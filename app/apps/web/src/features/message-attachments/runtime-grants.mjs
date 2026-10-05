export async function applyMessageAttachmentGrants(client, role) {
  if (
    typeof role !== "string" ||
    !/^[a-z][a-z0-9_]{1,62}$/.test(role) ||
    ["postgres", "public"].includes(role)
  )
    throw Error("Invalid runtime role.");
  const r = '"' + role + '"';
  await client.query(
    `REVOKE ALL ON treido.message_attachments,treido.message_attachment_objects FROM ${r}`,
  );
  await client.query(
    `GRANT SELECT,INSERT ON treido.message_attachments,treido.message_attachment_objects TO ${r}`,
  );
  await client.query(
    `GRANT UPDATE(state,revision,source_key,object_key,ready_checksum,ready_bytes,width,height,job_id,upload_token,upload_until,upload_attempts) ON treido.message_attachments TO ${r}`,
  );
  await client.query(
    `GRANT UPDATE(state,deletion_token,deletion_until,deleted_at) ON treido.message_attachment_objects TO ${r}`,
  );
  // Existing common grant denies link/message mutation; attachment-specific checks run in triggers.
}
