-- Original unnumbered T63 proposal. Sole canonical owner reviews/numbers/applies.
-- No approval/model/money/consent/provider data is seeded.
CREATE TABLE treido.assistant_runtime_policies (
  id uuid PRIMARY KEY,
  application_id text NOT NULL CHECK(application_id ~ '^app_[A-Za-z0-9]{3,128}$'),
  environment text NOT NULL CHECK(environment IN ('development','test','preview','production')),
  purpose text NOT NULL CHECK(purpose='shopping-input-v1'),
  config jsonb NOT NULL CHECK((jsonb_typeof(config)='object' AND config->>'version'='1'
    AND config->>'budgetCurrency'='USD' AND octet_length(config::text)<=16000) IS TRUE),
  approved_at timestamptz NOT NULL,
  revoked_at timestamptz CHECK(revoked_at IS NULL OR revoked_at>=approved_at)
);
CREATE UNIQUE INDEX assistant_policy_current ON treido.assistant_runtime_policies(application_id,environment) WHERE revoked_at IS NULL;
CREATE FUNCTION treido.guard_assistant_policy() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
BEGIN
  IF TG_OP='DELETE' OR (to_jsonb(NEW)-'revoked_at') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at')
    OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at) THEN
    RAISE EXCEPTION 'Immutable assistant policy' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER assistant_policy_immutable BEFORE UPDATE OR DELETE ON treido.assistant_runtime_policies FOR EACH ROW EXECUTE FUNCTION treido.guard_assistant_policy();

CREATE TABLE treido.buyer_assistant_consents (
  user_id uuid NOT NULL REFERENCES treido.users(id),
  mode text NOT NULL CHECK(mode IN ('text','photo','voice')),
  policy_id uuid NOT NULL REFERENCES treido.assistant_runtime_policies(id),
  revision integer NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 2147483646),
  granted boolean NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id,mode)
);
CREATE TABLE treido.assistant_media_assets (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES treido.users(id),
  mode text NOT NULL CHECK(mode IN ('photo','voice')),
  policy_id uuid NOT NULL REFERENCES treido.assistant_runtime_policies(id),
  input_hash text NOT NULL CHECK(input_hash ~ '^[a-f0-9]{64}$'),
  expected_bytes integer NOT NULL CHECK(expected_bytes BETWEEN 1 AND 12582912),
  content_type text NOT NULL CHECK(content_type IN ('image/jpeg','image/png','image/webp','audio/wav')),
  expected_checksum text NOT NULL CHECK(expected_checksum ~ '^[a-f0-9]{64}$'),
  storage_scope text NOT NULL CHECK(storage_scope ~ '^[a-f0-9]{64}$'),
  staging_key text NOT NULL CHECK(length(staging_key) BETWEEN 20 AND 300),
  immutable_key text,
  ready_key text,
  ready_checksum text CHECK(ready_checksum IS NULL OR ready_checksum ~ '^[a-f0-9]{64}$'),
  ready_bytes integer CHECK(ready_bytes BETWEEN 1 AND 12582912),
  state text NOT NULL DEFAULT 'staged' CHECK(state IN ('staged','validating','ready','unknown','cancelled','expired')),
  expires_at timestamptz NOT NULL,
  write_until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(id,user_id,mode), UNIQUE(id,user_id),
  CHECK(expires_at>created_at AND write_until>=expires_at AND write_until<=expires_at+interval '10 minutes'),
  CHECK((state<>'ready' OR (ready_key IS NOT NULL AND ready_checksum IS NOT NULL AND ready_bytes IS NOT NULL)) IS TRUE),
  CHECK((mode='voice' AND content_type='audio/wav') OR (mode='photo' AND content_type<>'audio/wav'))
);
CREATE TABLE treido.assistant_media_objects (
  storage_scope text NOT NULL CHECK(storage_scope ~ '^[a-f0-9]{64}$'),
  object_key text NOT NULL CHECK(length(object_key) BETWEEN 20 AND 300),
  user_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN ('staging','immutable','ready')),
  write_until timestamptz NOT NULL,
  retain_until timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'tracked' CHECK(state IN ('tracked','deleting','deleted')),
  deletion_token uuid,
  deletion_until timestamptz,
  deleted_at timestamptz,
  PRIMARY KEY(storage_scope,object_key),
  FOREIGN KEY(asset_id,user_id) REFERENCES treido.assistant_media_assets(id,user_id),
  CHECK(retain_until>=write_until),
  CHECK((deletion_token IS NULL)=(deletion_until IS NULL)),
  CHECK((state='deleted')=(deleted_at IS NOT NULL))
);
CREATE TABLE treido.assistant_runs (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES treido.users(id),
  mode text NOT NULL CHECK(mode IN ('text','photo','voice')),
  policy_id uuid NOT NULL REFERENCES treido.assistant_runtime_policies(id),
  media_id uuid,
  input_hash text NOT NULL CHECK(input_hash ~ '^[a-f0-9]{64}$'),
  input_json jsonb CHECK(input_json IS NULL OR (jsonb_typeof(input_json)='object' AND octet_length(input_json::text)<=16000) IS TRUE),
  proposal jsonb CHECK(proposal IS NULL OR (jsonb_typeof(proposal)='object' AND octet_length(proposal::text)<=16000) IS TRUE),
  accepted_criteria text CHECK(accepted_criteria IS NULL OR octet_length(accepted_criteria)<=6000),
  state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','calling','unknown','proposed','accepted','cancelled','failed')),
  provider_id text CHECK(provider_id IS NULL OR provider_id ~ '^gen_[0-9A-HJKMNP-TV-Z]{26}$'),
  steps integer NOT NULL DEFAULT 0 CHECK(steps BETWEEN 0 AND 6),
  emission_started_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(id,user_id,mode), UNIQUE(id,user_id),
  FOREIGN KEY(media_id,user_id,mode) REFERENCES treido.assistant_media_assets(id,user_id,mode),
  CHECK((mode='text' AND media_id IS NULL) OR (mode<>'text' AND media_id IS NOT NULL)),
  CHECK(expires_at>created_at)
  ,CHECK((steps=0)=(emission_started_at IS NULL))
  ,CHECK(provider_id IS NULL OR emission_started_at IS NOT NULL)
);
CREATE TABLE treido.buyer_assistant_workspaces (
  user_id uuid NOT NULL REFERENCES treido.users(id),
  mode text NOT NULL CHECK(mode IN ('text','photo','voice')),
  revision integer NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 2147483646),
  current_run_id uuid,
  current_asset_id uuid,
  PRIMARY KEY(user_id,mode),
  FOREIGN KEY(current_run_id,user_id,mode) REFERENCES treido.assistant_runs(id,user_id,mode),
  FOREIGN KEY(current_asset_id,user_id,mode) REFERENCES treido.assistant_media_assets(id,user_id,mode)
);
CREATE TABLE treido.assistant_run_reservations (
  run_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  application_id text NOT NULL,
  environment text NOT NULL CHECK(environment IN ('development','test','preview','production')),
  reserved_minor integer NOT NULL CHECK(reserved_minor BETWEEN 1 AND 1000000),
  actual_minor integer CHECK(actual_minor BETWEEN 0 AND 1000000),
  currency text NOT NULL CHECK(currency='USD'),
  status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','calling','unknown','settled','released')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(run_id,user_id) REFERENCES treido.assistant_runs(id,user_id),
  CHECK((status='settled')=(actual_minor IS NOT NULL))
);
CREATE INDEX assistant_reservation_budget ON treido.assistant_run_reservations(application_id,environment,created_at);
CREATE INDEX assistant_reservation_human ON treido.assistant_run_reservations(user_id,created_at);
CREATE TABLE treido.buyer_assistant_receipts (
  user_id uuid NOT NULL REFERENCES treido.users(id),
  request_id uuid NOT NULL,
  input_hash text NOT NULL CHECK(input_hash ~ '^[a-f0-9]{64}$'),
  operation text NOT NULL CHECK(operation IN ('consent','stage','complete','prepare','execute','accept','cancel')),
  accepted_revision integer NOT NULL CHECK(accepted_revision BETWEEN 1 AND 2147483646),
  run_id uuid,
  asset_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id,request_id),
  FOREIGN KEY(run_id,user_id) REFERENCES treido.assistant_runs(id,user_id),
  FOREIGN KEY(asset_id,user_id) REFERENCES treido.assistant_media_assets(id,user_id)
);
CREATE INDEX assistant_receipt_rate ON treido.buyer_assistant_receipts(user_id,created_at);
CREATE INDEX assistant_media_expiry ON treido.assistant_media_assets(expires_at,id) WHERE state NOT IN ('cancelled','expired');
CREATE INDEX assistant_object_expiry ON treido.assistant_media_objects(retain_until,user_id,asset_id) WHERE state<>'deleted';
CREATE INDEX assistant_run_expiry ON treido.assistant_runs(expires_at,id) WHERE input_json IS NOT NULL;
CREATE TABLE treido.assistant_usage_evidence (
  run_id uuid PRIMARY KEY REFERENCES treido.assistant_runs(id),
  provider_id text NOT NULL UNIQUE CHECK(provider_id ~ '^gen_[0-9A-HJKMNP-TV-Z]{26}$'),
  actual_minor integer NOT NULL CHECK(actual_minor BETWEEN 0 AND 1000000),
  currency text NOT NULL CHECK(currency='USD'),
  proof_hash text NOT NULL CHECK(proof_hash ~ '^[a-f0-9]{64}$'),
  observed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE FUNCTION treido.guard_assistant_records() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Assistant journal deletion denied' USING ERRCODE='23514'; END IF;
  IF TG_TABLE_NAME IN ('buyer_assistant_receipts','assistant_usage_evidence') THEN
    RAISE EXCEPTION 'Immutable assistant receipt' USING ERRCODE='23514';
  ELSIF TG_TABLE_NAME='assistant_run_reservations' THEN
    IF (to_jsonb(NEW)-'status'-'actual_minor') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'actual_minor')
      OR (OLD.status IN ('settled','released') AND NEW IS DISTINCT FROM OLD)
      OR (NEW.status='released' AND NEW.status IS DISTINCT FROM OLD.status AND (OLD.status NOT IN ('reserved','calling') OR NOT EXISTS(SELECT 1 FROM treido.assistant_runs WHERE id=OLD.run_id AND steps=0 AND emission_started_at IS NULL AND state IN ('cancelled','failed'))))
      OR (NEW.status='settled' AND NOT EXISTS(SELECT 1 FROM treido.assistant_usage_evidence WHERE run_id=OLD.run_id AND actual_minor=NEW.actual_minor)) THEN
      RAISE EXCEPTION 'Invalid assistant reservation transition' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME='assistant_runs' THEN
    IF (to_jsonb(NEW)-'input_json'-'proposal'-'accepted_criteria'-'state'-'provider_id'-'steps'-'emission_started_at') IS DISTINCT FROM (to_jsonb(OLD)-'input_json'-'proposal'-'accepted_criteria'-'state'-'provider_id'-'steps'-'emission_started_at')
      OR (NEW.input_json IS DISTINCT FROM OLD.input_json AND NOT(NEW.input_json IS NULL AND (NEW.state='cancelled' OR OLD.expires_at<=clock_timestamp())))
      OR (OLD.provider_id IS NOT NULL AND NEW.provider_id IS DISTINCT FROM OLD.provider_id)
      OR (OLD.emission_started_at IS NOT NULL AND NEW.emission_started_at IS DISTINCT FROM OLD.emission_started_at)
      OR NEW.steps<OLD.steps THEN RAISE EXCEPTION 'Immutable assistant run input' USING ERRCODE='23514'; END IF;
  ELSIF TG_TABLE_NAME='assistant_media_assets' THEN
    IF (to_jsonb(NEW)-'immutable_key'-'ready_key'-'ready_checksum'-'ready_bytes'-'state') IS DISTINCT FROM (to_jsonb(OLD)-'immutable_key'-'ready_key'-'ready_checksum'-'ready_bytes'-'state')
      OR (OLD.immutable_key IS NOT NULL AND NEW.immutable_key IS DISTINCT FROM OLD.immutable_key)
      OR (OLD.ready_key IS NOT NULL AND NEW.ready_key IS DISTINCT FROM OLD.ready_key)
      OR (OLD.ready_checksum IS NOT NULL AND NEW.ready_checksum IS DISTINCT FROM OLD.ready_checksum)
      OR (OLD.ready_bytes IS NOT NULL AND NEW.ready_bytes IS DISTINCT FROM OLD.ready_bytes) THEN RAISE EXCEPTION 'Immutable assistant media input' USING ERRCODE='23514'; END IF;
  ELSIF TG_TABLE_NAME='assistant_media_objects' THEN
    IF (to_jsonb(NEW)-'state'-'deletion_token'-'deletion_until'-'deleted_at') IS DISTINCT FROM (to_jsonb(OLD)-'state'-'deletion_token'-'deletion_until'-'deleted_at') OR (OLD.state='deleted' AND NEW IS DISTINCT FROM OLD)
      OR (NEW.state='deleting' AND (NEW.deletion_token IS NULL OR NEW.deletion_until IS NULL OR OLD.write_until>clock_timestamp() OR OLD.retain_until>clock_timestamp())) THEN
      RAISE EXCEPTION 'Immutable assistant object lease' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER assistant_run_guard BEFORE UPDATE OR DELETE ON treido.assistant_runs FOR EACH ROW EXECUTE FUNCTION treido.guard_assistant_records();
CREATE TRIGGER assistant_reservation_guard BEFORE UPDATE OR DELETE ON treido.assistant_run_reservations FOR EACH ROW EXECUTE FUNCTION treido.guard_assistant_records();
CREATE TRIGGER assistant_media_guard BEFORE UPDATE OR DELETE ON treido.assistant_media_assets FOR EACH ROW EXECUTE FUNCTION treido.guard_assistant_records();
CREATE TRIGGER assistant_object_guard BEFORE UPDATE OR DELETE ON treido.assistant_media_objects FOR EACH ROW EXECUTE FUNCTION treido.guard_assistant_records();
CREATE TRIGGER assistant_receipt_guard BEFORE UPDATE OR DELETE ON treido.buyer_assistant_receipts FOR EACH ROW EXECUTE FUNCTION treido.guard_assistant_records();
CREATE TRIGGER assistant_usage_guard BEFORE UPDATE OR DELETE ON treido.assistant_usage_evidence FOR EACH ROW EXECUTE FUNCTION treido.guard_assistant_records();
REVOKE ALL ON FUNCTION treido.guard_assistant_policy(),treido.guard_assistant_records() FROM PUBLIC;
