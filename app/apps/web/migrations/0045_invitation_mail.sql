-- Existing invitation intents remain the sole delivery queue. This migration sends no mail.
ALTER TABLE treido.invitation_deliveries DROP CONSTRAINT invitation_deliveries_state_check;
ALTER TABLE treido.invitation_deliveries ADD CONSTRAINT invitation_deliveries_state_check
  CHECK(state IN ('pending','submitted','sent','delivered','bounced','failed','complained','unavailable','uncertain','cancelled'));
ALTER TABLE treido.invitation_deliveries
  ADD COLUMN invitation_revision integer CHECK(invitation_revision>0),
  ADD COLUMN mail_binding jsonb CHECK(jsonb_typeof(mail_binding)='object'),
  ADD COLUMN provider_key varchar(256),
  ADD COLUMN observed_at timestamptz,
  ADD COLUMN last_checked_at timestamptz;
UPDATE treido.invitation_deliveries d SET invitation_revision=i.revision
  FROM treido.seller_invitations i WHERE i.id=d.invitation_id AND i.seller_id=d.seller_id;
ALTER TABLE treido.invitation_deliveries ALTER COLUMN invitation_revision SET NOT NULL;
CREATE INDEX invitation_mail_recovery ON treido.invitation_deliveries(state,last_checked_at,created_at);
CREATE UNIQUE INDEX invitation_mail_provider_key ON treido.invitation_deliveries(provider_key) WHERE provider_key IS NOT NULL;
CREATE UNIQUE INDEX invitation_mail_provider_object ON treido.invitation_deliveries((mail_binding->>'accountBinding'),provider_id) WHERE provider_id IS NOT NULL AND mail_binding IS NOT NULL;
CREATE FUNCTION treido.freeze_invitation_mail() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.id,NEW.seller_id,NEW.invitation_id,NEW.actor_id,NEW.seller_name,NEW.invitation_revision,NEW.created_at)
     IS DISTINCT FROM ROW(OLD.id,OLD.seller_id,OLD.invitation_id,OLD.actor_id,OLD.seller_name,OLD.invitation_revision,OLD.created_at)
     OR (OLD.first_attempt_at IS NOT NULL AND ROW(NEW.first_attempt_at,NEW.request_payload,NEW.mail_binding,NEW.provider_key)
       IS DISTINCT FROM ROW(OLD.first_attempt_at,OLD.request_payload,OLD.mail_binding,OLD.provider_key))
     OR (OLD.provider_id IS NOT NULL AND NEW.provider_id IS DISTINCT FROM OLD.provider_id) THEN
    RAISE EXCEPTION 'Invitation mail identity is immutable';
  END IF;
  IF NEW.first_attempt_at IS NOT NULL AND (NEW.request_payload IS NULL OR NEW.mail_binding IS NULL OR NEW.provider_key IS NULL) THEN
    RAISE EXCEPTION 'Invitation mail requires a bound request';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER invitation_mail_frozen BEFORE UPDATE ON treido.invitation_deliveries
  FOR EACH ROW EXECUTE FUNCTION treido.freeze_invitation_mail();
