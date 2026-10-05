-- Recipient decisions are explicit mutations; opening an invitation never consumes it.
ALTER TABLE treido.seller_invitations DROP CONSTRAINT seller_invitations_status_check;
ALTER TABLE treido.seller_invitations ADD CONSTRAINT seller_invitations_status_check
  CHECK(status IN ('pending','accepted','cancelled','expired','declined'));
ALTER TABLE treido.seller_invitations ADD COLUMN declined_by uuid REFERENCES treido.users(id);
ALTER TABLE treido.seller_invitations ADD COLUMN declined_at timestamptz;
ALTER TABLE treido.seller_invitations ADD CONSTRAINT invitation_declined_actor
  CHECK((status='declined')=(declined_by IS NOT NULL) AND (declined_by IS NULL)=(declined_at IS NULL));

-- Personal profile edits use the existing seller_accounts revision and seller_profiles projection.
-- Business profile/declaration commands retain their existing onboarding owner and receipts.
CREATE TABLE treido.personal_profile_receipts (
  seller_id uuid NOT NULL,
  seller_kind text NOT NULL DEFAULT 'personal' CHECK(seller_kind='personal'),
  actor_id uuid NOT NULL REFERENCES treido.users(id),
  request_id uuid NOT NULL,
  input_hash varchar(64) NOT NULL CHECK(input_hash ~ '^[0-9a-f]{64}$'),
  accepted_revision integer NOT NULL CHECK(accepted_revision>0),
  accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(seller_id,actor_id,request_id),
  FOREIGN KEY(seller_id,seller_kind) REFERENCES treido.seller_accounts(id,kind)
);
