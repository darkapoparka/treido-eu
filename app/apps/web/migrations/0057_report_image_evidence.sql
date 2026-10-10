-- Audit private image access through an exact report, never a public media URL.
CREATE TABLE treido.report_image_accesses (
 id uuid PRIMARY KEY,
 operator_id uuid NOT NULL REFERENCES treido.users(id),
 report_id uuid NOT NULL REFERENCES treido.reports(id),
 attachment_id uuid NOT NULL REFERENCES treido.message_attachments(id),
 attachment_revision integer NOT NULL CHECK(attachment_revision>0),
 checksum text NOT NULL CHECK(checksum ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX report_image_access_history ON treido.report_image_accesses(report_id,created_at DESC,id DESC);
CREATE TRIGGER report_image_access_immutable BEFORE UPDATE OR DELETE ON treido.report_image_accesses FOR EACH ROW EXECUTE FUNCTION treido.support_keep_evidence();
REVOKE ALL ON treido.report_image_accesses FROM PUBLIC;
