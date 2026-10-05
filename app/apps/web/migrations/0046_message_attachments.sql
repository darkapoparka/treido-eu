-- Private end-user raster attachments. No provider, policy, human or approval seed.
ALTER TABLE treido.message_attachments DROP CONSTRAINT message_attachments_state_check;
ALTER TABLE treido.message_attachments ADD CONSTRAINT message_attachments_state_check CHECK(state IN('staged','uploading','processing','ready','removed'));
ALTER TABLE treido.message_attachments ADD COLUMN storage_scope text CHECK(storage_scope ~ '^[a-f0-9]{64}$'),
 ADD COLUMN purpose text CHECK(purpose='private-message-images-v1'),
 ADD COLUMN request_id uuid, ADD COLUMN input_hash text CHECK(input_hash ~ '^[a-f0-9]{64}$'),
 ADD COLUMN source_checksum text CHECK(source_checksum ~ '^[a-f0-9]{64}$'),
 ADD COLUMN source_key varchar(300), ADD COLUMN ready_checksum text CHECK(ready_checksum ~ '^[a-f0-9]{64}$'),
 ADD COLUMN ready_bytes integer CHECK(ready_bytes BETWEEN 1 AND 8388608),
 ADD COLUMN width integer CHECK(width BETWEEN 1 AND 2048), ADD COLUMN height integer CHECK(height BETWEEN 1 AND 2048),
 ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 ADD COLUMN upload_token uuid, ADD COLUMN upload_until timestamptz,
 ADD COLUMN upload_attempts integer NOT NULL DEFAULT 0 CHECK(upload_attempts BETWEEN 0 AND 5),
 ADD COLUMN expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '24 hours',
 ADD COLUMN job_id uuid REFERENCES treido.outbox_jobs(id),
 ADD COLUMN operating_seller_id uuid REFERENCES treido.seller_accounts(id);
CREATE UNIQUE INDEX message_attachment_request ON treido.message_attachments(created_by,thread_id,request_id) WHERE request_id IS NOT NULL;
CREATE INDEX message_attachment_quota ON treido.message_attachments(created_by,created_at);
CREATE TABLE treido.message_attachment_objects(
 storage_scope text NOT NULL CHECK(storage_scope ~ '^[a-f0-9]{64}$'), object_key varchar(300) NOT NULL,
 attachment_id uuid NOT NULL REFERENCES treido.message_attachments(id),
 kind text NOT NULL CHECK(kind IN('source','ready')),
 state text NOT NULL DEFAULT 'tracked' CHECK(state IN('tracked','deleting','deleted')),
 write_until timestamptz NOT NULL, retain_until timestamptz NOT NULL,
 deletion_token uuid, deletion_until timestamptz, deleted_at timestamptz,
 PRIMARY KEY(storage_scope,object_key), CHECK((deletion_token IS NULL)=(deletion_until IS NULL))
);
CREATE FUNCTION treido.guard_message_attachment() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.state<>'staged' OR NEW.storage_scope IS NULL OR NEW.purpose<>'private-message-images-v1' OR NEW.request_id IS NULL OR NEW.input_hash IS NULL OR NEW.source_checksum IS NULL OR NEW.content_type NOT IN('image/jpeg','image/png','image/webp') OR NEW.bytes>8388608 OR NEW.source_key IS NOT NULL OR NEW.ready_checksum IS NOT NULL THEN RAISE EXCEPTION 'Unreviewed attachment intake denied' USING ERRCODE='23514'; END IF;
 ELSE
  IF OLD.state='removed' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Attachment tombstone immutable' USING ERRCODE='23514'; END IF;
  IF ROW(NEW.id,NEW.thread_id,NEW.created_by,NEW.content_type,NEW.bytes,NEW.storage_scope,NEW.purpose,NEW.request_id,NEW.input_hash,NEW.source_checksum,NEW.created_at,NEW.expires_at,NEW.operating_seller_id) IS DISTINCT FROM ROW(OLD.id,OLD.thread_id,OLD.created_by,OLD.content_type,OLD.bytes,OLD.storage_scope,OLD.purpose,OLD.request_id,OLD.input_hash,OLD.source_checksum,OLD.created_at,OLD.expires_at,OLD.operating_seller_id) THEN RAISE EXCEPTION 'Attachment source terms immutable' USING ERRCODE='23514'; END IF;
  IF NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'Attachment revision required' USING ERRCODE='23514'; END IF;
  IF OLD.state IN('processing','ready') AND ROW(NEW.source_key,NEW.job_id) IS DISTINCT FROM ROW(OLD.source_key,OLD.job_id) THEN RAISE EXCEPTION 'Accepted source immutable' USING ERRCODE='23514'; END IF;
  IF NOT((OLD.state='staged' AND NEW.state IN('uploading','removed')) OR (OLD.state='uploading' AND NEW.state IN('uploading','staged','processing','removed')) OR (OLD.state='processing' AND NEW.state IN('ready','removed')) OR (OLD.state='ready' AND NEW.state='removed')) THEN RAISE EXCEPTION 'Invalid attachment transition' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM treido.message_attachment_links WHERE attachment_id=OLD.id) THEN RAISE EXCEPTION 'Completed message attachment immutable' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.state='ready' AND (NEW.storage_scope IS NULL OR NEW.purpose<>'private-message-images-v1' OR NEW.ready_checksum IS NULL OR NEW.ready_bytes IS NULL OR NEW.width IS NULL OR NEW.height IS NULL OR NEW.source_key IS NULL OR NEW.job_id IS NULL OR NOT EXISTS(SELECT 1 FROM treido.message_attachment_objects o WHERE o.storage_scope=NEW.storage_scope AND o.object_key=NEW.object_key AND o.attachment_id=NEW.id AND o.kind='ready' AND o.state='tracked' AND o.write_until>clock_timestamp())) THEN RAISE EXCEPTION 'Attachment processing proof required' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER message_attachment_original BEFORE INSERT OR UPDATE ON treido.message_attachments FOR EACH ROW EXECUTE FUNCTION treido.guard_message_attachment();
CREATE FUNCTION treido.guard_message_attachment_object() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
BEGIN
 IF ROW(NEW.storage_scope,NEW.object_key,NEW.attachment_id,NEW.kind,NEW.write_until,NEW.retain_until) IS DISTINCT FROM ROW(OLD.storage_scope,OLD.object_key,OLD.attachment_id,OLD.kind,OLD.write_until,OLD.retain_until) OR (OLD.state='deleted' AND NEW IS DISTINCT FROM OLD) OR (OLD.state='deleting' AND NEW.state='tracked') THEN RAISE EXCEPTION 'Object tombstone immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER message_attachment_object_original BEFORE UPDATE ON treido.message_attachment_objects FOR EACH ROW EXECUTE FUNCTION treido.guard_message_attachment_object();
CREATE FUNCTION treido.guard_message_attachment_link() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
DECLARE asset treido.message_attachments; author uuid;
BEGIN
 SELECT * INTO asset FROM treido.message_attachments WHERE id=NEW.attachment_id AND thread_id=NEW.thread_id FOR UPDATE;
 SELECT author_id INTO author FROM treido.messages WHERE id=NEW.message_id AND thread_id=NEW.thread_id;
 IF asset.id IS NULL OR asset.created_by IS DISTINCT FROM author OR asset.state<>'ready' OR asset.storage_scope IS NULL OR asset.ready_checksum IS NULL OR asset.ready_bytes IS NULL OR asset.expires_at<=clock_timestamp() OR NOT EXISTS(SELECT 1 FROM treido.message_attachment_objects o WHERE o.storage_scope=asset.storage_scope AND o.object_key=asset.object_key AND o.attachment_id=asset.id AND o.kind='ready' AND o.state='tracked') THEN RAISE EXCEPTION 'Unprocessed attachment denied' USING ERRCODE='23514'; END IF;
 IF (SELECT count(*) FROM treido.message_attachment_links WHERE message_id=NEW.message_id)>=4 THEN RAISE EXCEPTION 'Attachment limit exceeded' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER message_attachment_link_ready BEFORE INSERT ON treido.message_attachment_links FOR EACH ROW EXECUTE FUNCTION treido.guard_message_attachment_link();
-- Extend the currently applied finite checks without replacing another feature's original kinds.
DO $$
DECLARE named text; expression text; extra text;
BEGIN
 FOREACH named IN ARRAY ARRAY['outbox_jobs_kind_check','outbox_jobs_authority_check','outbox_actor_authority','outbox_owner_scope'] LOOP
  SELECT pg_get_expr(conbin,conrelid) INTO expression FROM pg_constraint WHERE conrelid='treido.outbox_jobs'::regclass AND conname=named;
  IF expression IS NULL THEN RAISE EXCEPTION 'Required outbox constraint missing: %',named; END IF;
  extra:=CASE named
   WHEN 'outbox_jobs_kind_check' THEN 'kind IN(''message-attachment.process'',''message-attachment.expire'')'
   WHEN 'outbox_jobs_authority_check' THEN 'authority=''attachment'''
   WHEN 'outbox_actor_authority' THEN 'authority=''attachment'' AND actor_id IS NOT NULL'
   ELSE 'kind IN(''message-attachment.process'',''message-attachment.expire'') AND seller_id IS NOT NULL AND buyer_id IS NULL AND actor_id IS NOT NULL AND authority=''attachment'' AND operation_key=resource_id' END;
  EXECUTE format('ALTER TABLE treido.outbox_jobs DROP CONSTRAINT %I',named);
  EXECUTE format('ALTER TABLE treido.outbox_jobs ADD CONSTRAINT %I CHECK((%s) OR (%s))',named,expression,extra);
 END LOOP;
END $$;
ALTER TABLE treido.outbox_jobs ADD CONSTRAINT message_attachment_job_scope CHECK(kind NOT IN('message-attachment.process','message-attachment.expire') OR (seller_id IS NOT NULL AND buyer_id IS NULL AND authority='attachment' AND actor_id IS NOT NULL AND operation_key=resource_id));
CREATE FUNCTION treido.guard_message_attachment_job() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
BEGIN
 IF NEW.kind NOT IN('message-attachment.process','message-attachment.expire') THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN
  IF ROW(NEW.kind,NEW.seller_id,NEW.buyer_id,NEW.resource_id,NEW.operation_key,NEW.actor_id,NEW.authority,NEW.intent_hash) IS DISTINCT FROM ROW(OLD.kind,OLD.seller_id,OLD.buyer_id,OLD.resource_id,OLD.operation_key,OLD.actor_id,OLD.authority,OLD.intent_hash) THEN RAISE EXCEPTION 'Original attachment job immutable' USING ERRCODE='23514'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM treido.message_attachments a JOIN treido.conversation_threads t ON t.id=a.thread_id WHERE a.id=NEW.resource_id AND a.created_by=NEW.actor_id AND t.seller_id=NEW.seller_id AND a.purpose='private-message-images-v1' AND (NEW.kind='message-attachment.expire' OR a.state='uploading')) THEN RAISE EXCEPTION 'Foreign attachment job denied' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER message_attachment_job_original BEFORE INSERT OR UPDATE ON treido.outbox_jobs FOR EACH ROW EXECUTE FUNCTION treido.guard_message_attachment_job();
