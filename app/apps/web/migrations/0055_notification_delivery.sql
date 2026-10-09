CREATE TABLE treido.notification_email_preferences (
  user_id uuid PRIMARY KEY REFERENCES treido.users(id),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  consent_generation integer NOT NULL DEFAULT 0 CHECK (consent_generation >= 0),
  saved_search_email boolean NOT NULL DEFAULT false,
  message_email boolean NOT NULL DEFAULT false,
  language text NOT NULL DEFAULT 'bg' CHECK (language IN ('bg','en')),
  consent_version text NOT NULL CHECK (consent_version = 'email-notifications-v1'),
  consent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (NOT (saved_search_email OR message_email) OR consent_at IS NOT NULL)
);
CREATE TABLE treido.notification_email_receipts (
  user_id uuid NOT NULL REFERENCES treido.users(id),
  request_id uuid NOT NULL,
  input_hash varchar(64) NOT NULL CHECK (input_hash ~ '^[a-f0-9]{64}$'),
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id,request_id)
);
CREATE TABLE treido.notification_email_deliveries (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES treido.notification_email_preferences(user_id),
  kind text NOT NULL CHECK(kind IN ('saved-search','message')),
  source_id uuid NOT NULL,
  source_revision integer NOT NULL CHECK(source_revision > 0),
  seller_id uuid REFERENCES treido.seller_accounts(id),
  consent_generation integer NOT NULL CHECK(consent_generation > 0),
  language text NOT NULL CHECK(language IN ('bg','en')),
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','unavailable','uncertain','submitted','sent','delivered','bounced','failed','complained','cancelled')),
  first_attempt_at timestamptz,
  request_payload jsonb CHECK (request_payload IS NULL OR (jsonb_typeof(request_payload)='object' AND octet_length(request_payload::text)<=8192)),
  mail_binding jsonb CHECK (mail_binding IS NULL OR (jsonb_typeof(mail_binding)='object' AND octet_length(mail_binding::text)<=16384)),
  provider_key varchar(256),
  provider_id uuid,
  provider_state text CHECK(provider_state IS NULL OR provider_state IN ('submitted','sent','delivered','bounced','failed','complained')),
  submitted_at timestamptz,
  last_checked_at timestamptz,
  retry_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(user_id,kind,source_id,consent_generation),
  CHECK(first_attempt_at IS NULL OR (request_payload IS NOT NULL AND mail_binding IS NOT NULL AND provider_key IS NOT NULL)),
  CHECK(provider_id IS NULL OR first_attempt_at IS NOT NULL)
);
CREATE INDEX notification_email_due ON treido.notification_email_deliveries(retry_at,id) WHERE state IN ('pending','unavailable','uncertain');
CREATE INDEX notification_email_observe ON treido.notification_email_deliveries(last_checked_at,id) WHERE provider_id IS NOT NULL AND state IN ('submitted','sent','delivered','cancelled');
CREATE UNIQUE INDEX notification_email_provider_key ON treido.notification_email_deliveries(provider_key) WHERE provider_key IS NOT NULL;
CREATE UNIQUE INDEX notification_email_provider_object ON treido.notification_email_deliveries((mail_binding->>'accountBinding'),provider_id) WHERE provider_id IS NOT NULL AND mail_binding IS NOT NULL;
CREATE FUNCTION treido.freeze_notification_mail() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.id,NEW.user_id,NEW.kind,NEW.source_id,NEW.source_revision,NEW.seller_id,NEW.consent_generation,NEW.language,NEW.created_at)
  IS DISTINCT FROM ROW(OLD.id,OLD.user_id,OLD.kind,OLD.source_id,OLD.source_revision,OLD.seller_id,OLD.consent_generation,OLD.language,OLD.created_at)
  OR (OLD.first_attempt_at IS NOT NULL AND ROW(NEW.first_attempt_at,NEW.request_payload,NEW.mail_binding,NEW.provider_key)
   IS DISTINCT FROM ROW(OLD.first_attempt_at,OLD.request_payload,OLD.mail_binding,OLD.provider_key))
  OR (OLD.provider_id IS NOT NULL AND NEW.provider_id IS DISTINCT FROM OLD.provider_id)
  OR (OLD.state='cancelled' AND NEW.state<>'cancelled') THEN
  RAISE EXCEPTION 'Notification mail identity is immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER notification_mail_frozen BEFORE UPDATE ON treido.notification_email_deliveries
 FOR EACH ROW EXECUTE FUNCTION treido.freeze_notification_mail();

-- Additive optional-data removal. The original accepted-plan/lease/policy
-- authority runs first and holds its original locks throughout this wrapper.
ALTER FUNCTION treido.account_remove_optional_data(uuid,uuid) RENAME TO account_remove_optional_data_before_notification;
REVOKE ALL ON FUNCTION treido.account_remove_optional_data_before_notification(uuid,uuid) FROM PUBLIC;
CREATE FUNCTION treido.account_remove_optional_data(e uuid,t uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
DECLARE effect treido.account_lifecycle_effects;
BEGIN
 PERFORM treido.account_remove_optional_data_before_notification(e,t);
 SELECT * INTO effect FROM treido.account_lifecycle_effects WHERE id=e;
 IF effect.target->>'category'='profile' THEN
  DELETE FROM treido.notification_email_deliveries WHERE user_id=effect.user_id;
  DELETE FROM treido.notification_email_receipts WHERE user_id=effect.user_id;
  DELETE FROM treido.notification_email_preferences WHERE user_id=effect.user_id;
 ELSIF effect.target->>'category'='searches' THEN
  DELETE FROM treido.notification_email_deliveries WHERE user_id=effect.user_id AND kind='saved-search';
  UPDATE treido.notification_email_preferences SET saved_search_email=false,revision=revision+1,consent_generation=consent_generation+1,consent_at=CASE WHEN message_email THEN consent_at ELSE NULL END,updated_at=clock_timestamp() WHERE user_id=effect.user_id AND saved_search_email;
  UPDATE treido.notification_email_deliveries d SET state='cancelled',updated_at=clock_timestamp() WHERE d.user_id=effect.user_id AND d.provider_id IS NULL AND d.state IN('pending','unavailable','uncertain') AND EXISTS(SELECT 1 FROM treido.notification_email_preferences p WHERE p.user_id=d.user_id AND p.consent_generation<>d.consent_generation);
 END IF;
END $$;
REVOKE ALL ON FUNCTION treido.account_remove_optional_data(uuid,uuid) FROM PUBLIC;

-- Preserve the finite checks supplied by every previously applied feature.
DO $$
DECLARE named text; expression text; extra text;
BEGIN
 FOREACH named IN ARRAY ARRAY['outbox_jobs_kind_check','outbox_jobs_authority_check','outbox_actor_authority','outbox_owner_scope'] LOOP
  SELECT pg_get_expr(conbin,conrelid) INTO expression FROM pg_constraint WHERE conrelid='treido.outbox_jobs'::regclass AND conname=named;
  IF expression IS NULL THEN RAISE EXCEPTION 'Required outbox constraint missing: %',named; END IF;
  extra:=CASE named
   WHEN 'outbox_jobs_kind_check' THEN 'kind=''buyer.notification-email'''
   WHEN 'outbox_jobs_authority_check' THEN 'authority=''notification'''
   WHEN 'outbox_actor_authority' THEN 'authority=''notification'' AND actor_id IS NULL'
   ELSE 'kind=''buyer.notification-email'' AND seller_id IS NULL AND buyer_id IS NOT NULL AND actor_id IS NULL AND authority=''notification'' AND operation_key=resource_id' END;
  EXECUTE format('ALTER TABLE treido.outbox_jobs DROP CONSTRAINT %I',named);
  EXECUTE format('ALTER TABLE treido.outbox_jobs ADD CONSTRAINT %I CHECK((%s) OR (%s))',named,expression,extra);
 END LOOP;
END $$;
ALTER TABLE treido.outbox_jobs ADD CONSTRAINT notification_job_scope CHECK(kind<>'buyer.notification-email' OR (seller_id IS NULL AND buyer_id IS NOT NULL AND actor_id IS NULL AND authority='notification' AND operation_key=resource_id));
CREATE FUNCTION treido.guard_notification_job() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
BEGIN
 IF NEW.kind<>'buyer.notification-email' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN
  IF ROW(NEW.kind,NEW.seller_id,NEW.buyer_id,NEW.resource_id,NEW.operation_key,NEW.actor_id,NEW.authority,NEW.intent_hash) IS DISTINCT FROM ROW(OLD.kind,OLD.seller_id,OLD.buyer_id,OLD.resource_id,OLD.operation_key,OLD.actor_id,OLD.authority,OLD.intent_hash) THEN
   RAISE EXCEPTION 'Original notification job immutable' USING ERRCODE='23514';
  END IF;
 ELSIF NOT EXISTS(SELECT 1 FROM treido.notification_email_deliveries d WHERE d.id=NEW.resource_id AND d.user_id=NEW.buyer_id AND d.state IN('pending','unavailable','uncertain')) THEN
  RAISE EXCEPTION 'Foreign notification job denied' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER notification_job_owned BEFORE INSERT OR UPDATE ON treido.outbox_jobs FOR EACH ROW EXECUTE FUNCTION treido.guard_notification_job();

-- One boolean optimization only. Feature consumers retain all current authority.
-- Keep v1 for prior qualified callers and compose its complete existing coverage.
CREATE FUNCTION treido.repair_any_due_v2() RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
SELECT treido.repair_any_due_v1()
 OR EXISTS(SELECT 1 FROM treido.notification_email_deliveries d WHERE d.provider_id IS NOT NULL AND d.request_payload IS NOT NULL AND d.state IN('submitted','sent','delivered','cancelled') AND d.submitted_at>clock_timestamp()-interval '30 days' AND (d.last_checked_at IS NULL OR d.last_checked_at<clock_timestamp()-interval '10 minutes'))
 OR EXISTS(SELECT 1 FROM treido.buyer_search_notifications n JOIN treido.buyer_saved_searches s ON s.id=n.search_id AND s.user_id=n.user_id JOIN treido.users u ON u.id=n.user_id JOIN treido.notification_email_preferences p ON p.user_id=u.id
  WHERE u.status='active' AND p.saved_search_email AND p.consent_at IS NOT NULL AND n.created_at>=p.consent_at AND n.created_at>clock_timestamp()-interval '7 days' AND s.status='enabled' AND s.consent_at IS NOT NULL AND n.consent_generation=s.consent_generation AND n.criteria_version=s.criteria_version AND n.kind<>'unavailable' AND n.read_at IS NULL
  AND NOT EXISTS(SELECT 1 FROM treido.notification_email_deliveries d WHERE d.user_id=u.id AND d.kind='saved-search' AND d.source_id=n.id AND d.consent_generation=p.consent_generation))
 OR EXISTS(SELECT 1 FROM treido.message_notification_intents n JOIN treido.messages m ON m.id=n.message_id AND m.thread_id=n.thread_id JOIN treido.conversation_threads c ON c.id=m.thread_id JOIN treido.users u ON (n.recipient_side='buyer' AND u.id=c.buyer_id) OR (n.recipient_side='seller' AND (EXISTS(SELECT 1 FROM treido.personal_seller_owners o WHERE o.seller_id=c.seller_id AND o.user_id=u.id) OR EXISTS(SELECT 1 FROM treido.seller_memberships sm WHERE sm.seller_id=c.seller_id AND sm.user_id=u.id AND sm.status='active'))) JOIN treido.notification_email_preferences p ON p.user_id=u.id
  WHERE u.status='active' AND m.author_id<>u.id AND p.message_email AND p.consent_at IS NOT NULL AND m.created_at>=p.consent_at AND m.created_at>clock_timestamp()-interval '7 days'
  AND NOT EXISTS(SELECT 1 FROM treido.notification_email_deliveries d WHERE d.user_id=u.id AND d.kind='message' AND d.source_id=m.id AND d.consent_generation=p.consent_generation))
$$;
REVOKE ALL ON FUNCTION treido.repair_any_due_v2() FROM PUBLIC;
