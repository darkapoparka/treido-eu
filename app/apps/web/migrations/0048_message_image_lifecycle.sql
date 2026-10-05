-- Message images are a separately reviewed extension, never personal-listing media.
-- No approval, binding, hold, retention interval or provider seed.
CREATE TABLE treido.message_image_lifecycle_policies (
 id uuid PRIMARY KEY, version text NOT NULL CHECK(version='message-image-lifecycle-v1'),
 policy_id uuid NOT NULL REFERENCES treido.account_closure_policies(id),
 binding_id uuid NOT NULL REFERENCES treido.account_lifecycle_bindings(id),
 storage_scope text NOT NULL CHECK(storage_scope ~ '^[a-f0-9]{64}$'),
 handling text NOT NULL CHECK(handling IN('retain','remove')), delay_seconds integer,
 description jsonb NOT NULL CHECK((jsonb_typeof(description->'bg')='string' AND length(btrim(description->>'bg')) BETWEEN 1 AND 12000 AND jsonb_typeof(description->'en')='string' AND length(btrim(description->>'en')) BETWEEN 1 AND 12000) IS TRUE),
 preserves_business boolean NOT NULL CHECK(preserves_business), preserves_counterpart boolean NOT NULL CHECK(preserves_counterpart),
 preserves_case_commerce boolean NOT NULL CHECK(preserves_case_commerce), legal_holds_reviewed boolean NOT NULL CHECK(legal_holds_reviewed),
 approved_at timestamptz NOT NULL, approval_reference text NOT NULL CHECK(length(btrim(approval_reference)) BETWEEN 1 AND 500), revoked_at timestamptz,
 CHECK(((handling='retain' AND delay_seconds IS NULL) OR (handling='remove' AND delay_seconds IS NOT NULL AND delay_seconds>=0)) IS TRUE),
 CHECK(revoked_at IS NULL OR revoked_at>=approved_at)
);
CREATE UNIQUE INDEX message_image_current_policy ON treido.message_image_lifecycle_policies(policy_id,binding_id) WHERE revoked_at IS NULL;
CREATE TRIGGER message_image_policy_immutable BEFORE UPDATE OR DELETE ON treido.message_image_lifecycle_policies FOR EACH ROW EXECUTE FUNCTION treido.account_keep_registry();
CREATE FUNCTION treido.account_message_image_available(u uuid,p uuid,b uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,treido,pg_temp AS $$
 SELECT NOT EXISTS(SELECT 1 FROM treido.message_attachments a JOIN treido.message_attachment_objects o ON o.attachment_id=a.id WHERE a.created_by=u AND o.state<>'deleted') OR EXISTS(SELECT 1 FROM treido.message_image_lifecycle_policies WHERE policy_id=p AND binding_id=b AND approved_at<=clock_timestamp() AND revoked_at IS NULL)
$$;
REVOKE ALL ON FUNCTION treido.account_message_image_available(uuid,uuid,uuid) FROM PUBLIC;
CREATE TABLE treido.message_image_legal_holds (
 id uuid PRIMARY KEY, user_id uuid REFERENCES treido.users(id), attachment_id uuid REFERENCES treido.message_attachments(id),
 message_id uuid REFERENCES treido.messages(id), approved_at timestamptz NOT NULL,
 approval_reference text NOT NULL CHECK(length(btrim(approval_reference)) BETWEEN 1 AND 500), revoked_at timestamptz,
 CHECK(num_nonnulls(user_id,attachment_id,message_id)=1), CHECK(revoked_at IS NULL OR revoked_at>=approved_at)
);
CREATE TRIGGER message_image_hold_immutable BEFORE UPDATE OR DELETE ON treido.message_image_legal_holds FOR EACH ROW EXECUTE FUNCTION treido.account_keep_registry();
CREATE TABLE treido.message_image_tombstones (
 attachment_id uuid PRIMARY KEY REFERENCES treido.message_attachments(id), user_id uuid NOT NULL REFERENCES treido.users(id),
 plan_id uuid NOT NULL REFERENCES treido.account_execution_plans(id), effect_id uuid NOT NULL REFERENCES treido.account_lifecycle_effects(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TRIGGER message_image_tombstone_immutable BEFORE UPDATE OR DELETE ON treido.message_image_tombstones FOR EACH ROW EXECUTE FUNCTION treido.account_keep_receipt();

-- Conservatively preserve every report (including reviewed evidence), accepted
-- offer/payment/order relationship and genuine legal hold; no expiry is inferred.
CREATE FUNCTION treido.message_image_retention_reason(a uuid) RETURNS text
LANGUAGE sql STABLE SET search_path=pg_catalog,treido,pg_temp AS $$
 SELECT CASE
 WHEN image.operating_seller_id IS NOT NULL AND image.operating_seller_id<>thread.seller_id THEN 'unknown-authority'
 WHEN image.operating_seller_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM treido.personal_seller_owners p JOIN treido.seller_accounts s ON s.id=p.seller_id AND s.kind='personal' WHERE p.seller_id=image.operating_seller_id AND p.user_id=image.created_by) THEN 'business'
 WHEN image.operating_seller_id IS NULL AND thread.buyer_id<>image.created_by THEN 'unknown-authority'
 WHEN EXISTS(SELECT 1 FROM treido.message_image_legal_holds h WHERE h.approved_at<=clock_timestamp() AND h.revoked_at IS NULL AND (h.user_id=image.created_by OR h.attachment_id=image.id OR h.message_id=link.message_id))
   OR EXISTS(SELECT 1 FROM treido.order_aftercare_legal_holds h WHERE h.approved_at<=clock_timestamp() AND h.revoked_at IS NULL AND (h.user_id=image.created_by OR EXISTS(SELECT 1 FROM treido.paid_orders o JOIN treido.payable_quote_lines q ON q.quote_id=o.quote_id WHERE o.id=h.order_id AND q.listing_id=thread.listing_id AND o.buyer_id=thread.buyer_id AND o.seller_id=thread.seller_id))) THEN 'legal-hold'
 WHEN EXISTS(SELECT 1 FROM treido.reports r WHERE (r.resource_kind='message' AND EXISTS(SELECT 1 FROM treido.messages m WHERE m.id=r.resource_id AND m.thread_id=thread.id)) OR (r.resource_kind='listing' AND r.resource_id=thread.listing_id)) THEN 'case'
 WHEN EXISTS(SELECT 1 FROM treido.listing_offers o WHERE o.thread_id=thread.id AND o.state='accepted') OR EXISTS(SELECT 1 FROM treido.offer_events e WHERE e.thread_id=thread.id AND e.kind='accepted')
   OR EXISTS(SELECT 1 FROM treido.payable_quote_lines q JOIN treido.payable_quotes quote ON quote.id=q.quote_id WHERE q.listing_id=thread.listing_id AND quote.buyer_id=thread.buyer_id AND quote.seller_id=thread.seller_id AND EXISTS(SELECT 1 FROM treido.payment_attempts p WHERE p.quote_id=q.quote_id)) THEN 'commerce'
 ELSE NULL END
 FROM treido.message_attachments image JOIN treido.conversation_threads thread ON thread.id=image.thread_id
 LEFT JOIN treido.message_attachment_links link ON link.attachment_id=image.id WHERE image.id=a
$$;

CREATE FUNCTION treido.account_message_image_review(u uuid,p uuid,b uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,treido,pg_temp AS $$
DECLARE rule treido.message_image_lifecycle_policies; resources jsonb;
BEGIN
 PERFORM 1 FROM treido.users WHERE id=u FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown image owner' USING ERRCODE='23514'; END IF;
 -- Same author lock as intake; immutable links/objects are read in asset/key order.
 PERFORM 1 FROM treido.message_attachments WHERE created_by=u ORDER BY id FOR SHARE;
 PERFORM 1 FROM treido.message_attachment_objects o JOIN treido.message_attachments a ON a.id=o.attachment_id WHERE a.created_by=u AND o.state<>'deleted' ORDER BY o.storage_scope,o.object_key FOR SHARE OF o;
 IF NOT EXISTS(SELECT 1 FROM treido.message_attachments a JOIN treido.message_attachment_objects o ON o.attachment_id=a.id WHERE a.created_by=u AND o.state<>'deleted') THEN RETURN NULL; END IF;
 SELECT * INTO rule FROM treido.message_image_lifecycle_policies WHERE policy_id=p AND binding_id=b AND approved_at<=clock_timestamp() AND revoked_at IS NULL FOR SHARE;
 IF rule.id IS NULL OR NOT EXISTS(SELECT 1 FROM treido.account_lifecycle_bindings binding JOIN treido.account_closure_policies policy ON policy.id=p WHERE binding.id=b AND binding.approved_at<=clock_timestamp() AND binding.revoked_at IS NULL AND binding.closure_enabled AND binding.media_unversioned AND binding.media_scope IS NOT NULL AND rule.storage_scope=encode(sha256(convert_to('["'||binding.media_scope||'","private-message-images-v1"]','UTF8')),'hex') AND policy.approved_at<=clock_timestamp() AND policy.revoked_at IS NULL) THEN RAISE EXCEPTION 'Reviewed message image lifecycle required' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM treido.message_attachments a JOIN treido.message_attachment_objects o ON o.attachment_id=a.id WHERE a.created_by=u AND o.state<>'deleted' AND (o.storage_scope<>rule.storage_scope OR o.write_until>clock_timestamp() OR o.state='deleting' OR a.upload_until>clock_timestamp() OR a.state IN('uploading','processing'))) THEN RAISE EXCEPTION 'Message image scope or writer held' USING ERRCODE='55000'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object(
 'target',jsonb_build_object('ownerKind','message-image','ownerUserId',u,'assetId',a.id,'storageScope',o.storage_scope,'objectKey',o.object_key),
 'assetRevision',a.revision,'assetState',a.state,'sourceKey',a.source_key,'readyKey',a.object_key,'readyChecksum',a.ready_checksum,
 'threadId',a.thread_id,'messageId',l.message_id,'operatingSellerId',a.operating_seller_id,
 'uploadUntil',a.upload_until,'objectKind',o.kind,'objectState',o.state,'writeUntil',o.write_until,'retainUntil',o.retain_until,
 'retentionReason',treido.message_image_retention_reason(a.id)) ORDER BY o.storage_scope,o.object_key),'[]'::jsonb) INTO resources
 FROM treido.message_attachments a JOIN treido.message_attachment_objects o ON o.attachment_id=a.id LEFT JOIN treido.message_attachment_links l ON l.attachment_id=a.id WHERE a.created_by=u AND o.state<>'deleted';
 IF jsonb_array_length(resources)>100 THEN RAISE EXCEPTION 'Message image target bound' USING ERRCODE='55000'; END IF;
 RETURN jsonb_build_object('version',rule.version,'rule',to_jsonb(rule),'resources',resources);
END $$;

CREATE FUNCTION treido.account_guard_message_image_plan() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido,pg_temp AS $$
DECLARE review jsonb; targets jsonb; frozen jsonb;
BEGIN
 IF OLD.state='reviewed' AND NEW.state='accepted' THEN
  review:=treido.account_message_image_review(NEW.user_id,NEW.policy_id,NEW.binding_id);
  IF review IS DISTINCT FROM NEW.payload->'messageImages' AND NOT(review IS NULL AND (NEW.payload->'messageImages' IS NULL OR NEW.payload->'messageImages'='null'::jsonb)) THEN RAISE EXCEPTION 'Changed message image resources; review again' USING ERRCODE='23514'; END IF;
  SELECT coalesce(jsonb_agg(r->'target' ORDER BY (r->'target')::text),'[]'::jsonb) INTO targets FROM jsonb_array_elements(review->'resources') r WHERE review->'rule'->>'handling'='remove' AND r->'retentionReason'='null'::jsonb;
  SELECT coalesce(jsonb_agg(t->'target' ORDER BY (t->'target')::text),'[]'::jsonb) INTO frozen FROM jsonb_array_elements(NEW.payload->'targets') t WHERE t->'target'->>'ownerKind'='message-image' AND t->>'kind'='media.delete';
  IF targets IS DISTINCT FROM frozen OR EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.payload->'targets') t WHERE t->'target'->>'ownerKind'='message-image' AND (t->>'kind'<>'media.delete' OR (t->>'dueSeconds')::integer IS DISTINCT FROM (review->'rule'->>'delay_seconds')::integer)) THEN RAISE EXCEPTION 'Frozen message image targets denied' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.state='completed' THEN PERFORM treido.account_assert_message_image_plan(NEW.id); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER account_message_image_acceptance BEFORE UPDATE OF state ON treido.account_execution_plans FOR EACH ROW EXECUTE FUNCTION treido.account_guard_message_image_plan();

CREATE FUNCTION treido.account_assert_message_image_plan(p uuid) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog,treido,pg_temp AS $$
DECLARE plan treido.account_execution_plans; rule treido.message_image_lifecycle_policies;
BEGIN
 SELECT * INTO plan FROM treido.account_execution_plans WHERE id=p;
 IF EXISTS(SELECT 1 FROM treido.message_attachments a JOIN treido.message_attachment_objects o ON o.attachment_id=a.id WHERE a.created_by=plan.user_id AND o.state<>'deleted') OR plan.payload->'messageImages'->>'version' IS NOT NULL THEN
  SELECT * INTO rule FROM treido.message_image_lifecycle_policies WHERE id=(plan.payload->'messageImages'->'rule'->>'id')::uuid AND policy_id=plan.policy_id AND binding_id=plan.binding_id AND approved_at<=clock_timestamp() AND revoked_at IS NULL FOR SHARE;
  IF rule.id IS NULL OR to_jsonb(rule) IS DISTINCT FROM plan.payload->'messageImages'->'rule' OR plan.payload->'messageImages'->>'version' IS DISTINCT FROM rule.version THEN RAISE EXCEPTION 'Original reviewed message image extension required' USING ERRCODE='55000'; END IF;
 END IF;
END $$;

-- Original lifecycle function calls this only after user/plan/job/effect locks,
-- frozen target membership, registry checks and current obligations checks.
CREATE FUNCTION treido.account_claim_message_image(e uuid,t uuid) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog,treido,pg_temp AS $$
DECLARE effect treido.account_lifecycle_effects; plan treido.account_execution_plans; asset treido.message_attachments; obj treido.message_attachment_objects;
BEGIN
 SELECT * INTO effect FROM treido.account_lifecycle_effects WHERE id=e;
 SELECT * INTO plan FROM treido.account_execution_plans WHERE id=effect.plan_id;
 PERFORM treido.account_assert_message_image_plan(plan.id);
 IF effect.target->>'ownerUserId' IS DISTINCT FROM effect.user_id::text OR plan.payload->'messageImages'->'rule'->>'handling' IS DISTINCT FROM 'remove' OR effect.due_at<plan.accepted_at+make_interval(secs=>(plan.payload->'messageImages'->'rule'->>'delay_seconds')::integer) THEN RAISE EXCEPTION 'Reviewed image removal denied' USING ERRCODE='23514'; END IF;
 SELECT * INTO asset FROM treido.message_attachments WHERE id=(effect.target->>'assetId')::uuid AND created_by=effect.user_id FOR UPDATE;
 SELECT * INTO obj FROM treido.message_attachment_objects WHERE attachment_id=asset.id AND storage_scope=effect.target->>'storageScope' AND object_key=effect.target->>'objectKey' FOR UPDATE;
 IF t IS NULL OR asset.id IS NULL OR obj.attachment_id IS NULL OR asset.storage_scope IS DISTINCT FROM obj.storage_scope OR obj.storage_scope IS DISTINCT FROM plan.payload->'messageImages'->'rule'->>'storage_scope' OR treido.message_image_retention_reason(asset.id) IS NOT NULL OR obj.write_until>clock_timestamp() OR obj.retain_until>clock_timestamp() OR obj.deletion_until>clock_timestamp() OR asset.upload_until>clock_timestamp() OR asset.state IN('uploading','processing') THEN RAISE EXCEPTION 'Current message image held' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(plan.payload->'messageImages'->'resources') r WHERE r->'target'=effect.target AND (r->>'assetRevision')::integer=asset.revision AND r->>'assetState'=asset.state AND r->'messageId' IS NOT DISTINCT FROM coalesce((SELECT to_jsonb(l.message_id) FROM treido.message_attachment_links l WHERE l.attachment_id=asset.id),'null'::jsonb) AND r->'writeUntil'=to_jsonb(obj.write_until) AND r->'retainUntil'=to_jsonb(obj.retain_until)) THEN RAISE EXCEPTION 'Changed accepted message image' USING ERRCODE='23514'; END IF;
 INSERT INTO treido.message_image_tombstones(attachment_id,user_id,plan_id,effect_id) VALUES(asset.id,effect.user_id,plan.id,e) ON CONFLICT(attachment_id) DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM treido.message_image_tombstones WHERE attachment_id=asset.id AND user_id=effect.user_id AND plan_id=plan.id) THEN RAISE EXCEPTION 'Foreign image tombstone' USING ERRCODE='23514'; END IF;
 UPDATE treido.message_attachment_objects SET state='deleting',deletion_token=t,deletion_until=clock_timestamp()+interval '60 seconds' WHERE storage_scope=obj.storage_scope AND object_key=obj.object_key AND state<>'deleted';
END $$;

-- Linked processed images need lifecycle authority. Raw source uploads keep
-- their original registered cleanup deadline; tombstoned assets remain protected.
CREATE FUNCTION treido.guard_linked_message_image_object() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido,pg_temp AS $$
BEGIN
 IF ((OLD.kind='ready' AND EXISTS(SELECT 1 FROM treido.message_attachment_links WHERE attachment_id=OLD.attachment_id)) OR EXISTS(SELECT 1 FROM treido.message_image_tombstones WHERE attachment_id=OLD.attachment_id)) AND current_user IS DISTINCT FROM (SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='treido.message_attachment_objects'::regclass) THEN RAISE EXCEPTION 'Linked image lifecycle authority required' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER linked_message_image_object_guard BEFORE UPDATE OR DELETE ON treido.message_attachment_objects FOR EACH ROW EXECUTE FUNCTION treido.guard_linked_message_image_object();

CREATE FUNCTION treido.guard_message_image_writer() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido,pg_temp AS $$
DECLARE owner_id uuid; image_id uuid; image treido.message_attachments;
BEGIN
 IF TG_TABLE_NAME='message_attachment_objects' THEN
  SELECT * INTO image FROM treido.message_attachments WHERE id=NEW.attachment_id;
  owner_id:=image.created_by;
  image_id:=image.id;
  IF image.id IS NULL OR image.storage_scope IS DISTINCT FROM NEW.storage_scope OR NEW.state<>'tracked' THEN RAISE EXCEPTION 'Original image registration required' USING ERRCODE='23514'; END IF;
  IF NEW.object_key !~ ('^[a-zA-Z0-9/_-]+/message-attachments/'||NEW.kind||'/'||image.id::text||'/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'||CASE WHEN NEW.kind='ready' THEN '\.webp$' ELSE '$' END) THEN RAISE EXCEPTION 'Exact message image namespace required' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM treido.message_attachment_links WHERE attachment_id=image.id) THEN RAISE EXCEPTION 'Linked image registration immutable' USING ERRCODE='23514'; END IF;
 ELSE owner_id:=NEW.created_by; image_id:=NEW.id; END IF;
 PERFORM 1 FROM treido.users WHERE id=owner_id AND status='active' FOR SHARE;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM treido.message_image_tombstones WHERE attachment_id=image_id) THEN RAISE EXCEPTION 'Current image writer denied' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER message_image_current_writer BEFORE INSERT OR UPDATE ON treido.message_attachments FOR EACH ROW EXECUTE FUNCTION treido.guard_message_image_writer();
CREATE TRIGGER message_image_current_registration BEFORE INSERT ON treido.message_attachment_objects FOR EACH ROW EXECUTE FUNCTION treido.guard_message_image_writer();

CREATE FUNCTION treido.guard_message_image_link_lifecycle() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido,pg_temp AS $$
DECLARE owner_id uuid;
BEGIN
 SELECT created_by INTO owner_id FROM treido.message_attachments WHERE id=NEW.attachment_id;
 PERFORM 1 FROM treido.users WHERE id=owner_id AND status='active' FOR SHARE;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM treido.message_image_tombstones WHERE attachment_id=NEW.attachment_id) THEN RAISE EXCEPTION 'Current original image link authority denied' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
-- Runs before the original attachment-row lock; normal send holds actor first.
CREATE TRIGGER a_message_image_link_lifecycle BEFORE INSERT ON treido.message_attachment_links FOR EACH ROW EXECUTE FUNCTION treido.guard_message_image_link_lifecycle();
REVOKE ALL ON FUNCTION treido.guard_message_image_link_lifecycle() FROM PUBLIC;

CREATE FUNCTION treido.lock_message_image_hold_owner() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido,pg_temp AS $$
BEGIN
 PERFORM 1 FROM treido.users u WHERE u.id=NEW.user_id OR EXISTS(SELECT 1 FROM treido.message_attachments a LEFT JOIN treido.message_attachment_links l ON l.attachment_id=a.id WHERE a.created_by=u.id AND (a.id=NEW.attachment_id OR l.message_id=NEW.message_id)) ORDER BY u.id FOR UPDATE;
 RETURN NEW;
END $$;
CREATE TRIGGER message_image_hold_owner_lock BEFORE INSERT OR UPDATE ON treido.message_image_legal_holds FOR EACH ROW EXECUTE FUNCTION treido.lock_message_image_hold_owner();
REVOKE ALL ON FUNCTION treido.guard_message_image_writer(),treido.lock_message_image_hold_owner() FROM PUBLIC;

CREATE FUNCTION treido.account_message_image_io(e uuid,t uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,treido,pg_temp AS $$
DECLARE effect treido.account_lifecycle_effects; plan treido.account_execution_plans;
BEGIN
 SELECT * INTO effect FROM treido.account_lifecycle_effects WHERE id=e;
 PERFORM 1 FROM treido.users WHERE id=effect.user_id AND clerk_subject=effect.subject AND status IN('restricted','closed') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Current image lifecycle identity denied' USING ERRCODE='23514'; END IF;
 SELECT * INTO plan FROM treido.account_execution_plans WHERE id=effect.plan_id AND user_id=effect.user_id FOR UPDATE;
 SELECT * INTO effect FROM treido.account_lifecycle_effects WHERE id=e FOR UPDATE;
 IF t IS NULL OR effect.kind IS DISTINCT FROM 'media.delete' OR effect.target->>'ownerKind' IS DISTINCT FROM 'message-image' OR effect.lease_token IS DISTINCT FROM t OR effect.lease_until IS NULL OR effect.lease_until<=clock_timestamp() OR effect.state NOT IN('attempting','unknown') OR plan.accepted_at IS NULL OR plan.state NOT IN('accepted','processing','blocked','reconciling') OR effect.binding_id<>plan.binding_id OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(plan.payload->'targets') target WHERE target->>'kind'=effect.kind AND target->'target'=effect.target) OR NOT EXISTS(SELECT 1 FROM treido.outbox_jobs j JOIN treido.job_effects lease ON lease.job_id=j.id WHERE j.kind='account.closure' AND j.authority='closure' AND j.buyer_id=effect.user_id AND j.actor_id IS NULL AND j.seller_id IS NULL AND j.resource_id=plan.id AND j.operation_key=plan.acceptance_key AND lease.state='running' AND lease.execution_until>clock_timestamp()) THEN RAISE EXCEPTION 'Original image effect lease denied' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM treido.account_lifecycle_bindings b JOIN treido.account_closure_policies p ON p.id=plan.policy_id WHERE b.id=plan.binding_id AND b.approved_at<=clock_timestamp() AND b.revoked_at IS NULL AND b.closure_enabled AND b.media_unversioned AND p.approved_at<=clock_timestamp() AND p.revoked_at IS NULL AND p.payload=plan.payload->'policy' FOR SHARE OF b,p;
 IF NOT FOUND THEN RAISE EXCEPTION 'Current image binding or policy denied' USING ERRCODE='55000'; END IF;
 PERFORM treido.account_assert_message_image_plan(plan.id);
 PERFORM treido.account_lock_resources(effect.user_id);
 IF treido.message_image_retention_reason((effect.target->>'assetId')::uuid) IS NOT NULL THEN RAISE EXCEPTION 'Current image hold' USING ERRCODE='55000'; END IF;
 PERFORM 1 FROM treido.message_attachments a JOIN treido.message_attachment_objects o ON o.attachment_id=a.id JOIN treido.message_image_tombstones tomb ON tomb.attachment_id=a.id WHERE a.id::text=effect.target->>'assetId' AND a.created_by=effect.user_id AND tomb.user_id=effect.user_id AND tomb.plan_id=plan.id AND a.storage_scope=o.storage_scope AND o.storage_scope=effect.target->>'storageScope' AND o.object_key=effect.target->>'objectKey' AND o.state='deleting' AND o.deletion_token=t AND o.deletion_until>clock_timestamp() AND o.write_until<=clock_timestamp() AND o.retain_until<=clock_timestamp() AND a.state NOT IN('uploading','processing') AND (a.upload_until IS NULL OR a.upload_until<=clock_timestamp()) FOR SHARE OF a,o;
 IF NOT FOUND THEN RAISE EXCEPTION 'Exact registered image object denied' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM treido.message_attachments a JOIN treido.message_attachment_objects o ON o.attachment_id=a.id CROSS JOIN LATERAL jsonb_array_elements(plan.payload->'messageImages'->'resources') r WHERE r->'target'=effect.target AND a.id::text=effect.target->>'assetId' AND o.storage_scope=effect.target->>'storageScope' AND o.object_key=effect.target->>'objectKey' AND (r->>'assetRevision')::integer=a.revision AND r->>'assetState'=a.state AND r->'writeUntil'=to_jsonb(o.write_until) AND r->'retainUntil'=to_jsonb(o.retain_until) AND r->'messageId'=coalesce((SELECT to_jsonb(l.message_id) FROM treido.message_attachment_links l WHERE l.attachment_id=a.id),'null'::jsonb)) THEN RAISE EXCEPTION 'Current image revision or link changed' USING ERRCODE='23514'; END IF;
END $$;
REVOKE ALL ON FUNCTION treido.account_message_image_io(uuid,uuid) FROM PUBLIC;

REVOKE ALL ON treido.message_image_lifecycle_policies,treido.message_image_legal_holds,treido.message_image_tombstones FROM PUBLIC;
REVOKE ALL ON FUNCTION treido.message_image_retention_reason(uuid),treido.account_message_image_review(uuid,uuid,uuid),treido.account_guard_message_image_plan(),treido.account_assert_message_image_plan(uuid),treido.account_claim_message_image(uuid,uuid),treido.guard_linked_message_image_object() FROM PUBLIC;

-- Original T71 and lifecycle bodies retained, with finite message-image branches.
CREATE OR REPLACE FUNCTION treido.account_guard_cleanup_acceptance() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido,pg_temp AS $$
DECLARE personal boolean; assistant boolean; resources jsonb; reviewed_targets jsonb; fresh_targets jsonb;
BEGIN
 IF OLD.state='reviewed' AND NEW.state='accepted' THEN
  SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.payload->'policy'->'rules') r WHERE r->>'category'='personalMedia' AND r->>'handling'='remove' AND r->>'trigger'='closure'),
         EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.payload->'policy'->'rules') r WHERE r->>'category'='assistantMedia' AND r->>'handling'='remove' AND r->>'trigger'='closure') INTO personal,assistant;
  IF personal OR assistant THEN
   resources:=treido.account_closure_cleanup_resources(NEW.user_id,personal,assistant);
   SELECT coalesce(jsonb_agg(t->'target' ORDER BY (t->'target')::text),'[]'::jsonb) INTO reviewed_targets FROM jsonb_array_elements(NEW.payload->'targets') t WHERE t->>'kind'='media.delete' AND t->'target'->>'ownerKind' IS DISTINCT FROM 'message-image';
   SELECT coalesce(jsonb_agg(r->'target' ORDER BY (r->'target')::text),'[]'::jsonb) INTO fresh_targets FROM jsonb_array_elements(resources) r;
   IF resources IS DISTINCT FROM NEW.payload->'cleanupResources' OR reviewed_targets IS DISTINCT FROM fresh_targets THEN
    RAISE EXCEPTION 'Changed closure cleanup resources; review again' USING ERRCODE='23514';
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION treido.account_claim_effect(e uuid,t uuid,j uuid,execution uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
DECLARE effect treido.account_lifecycle_effects; plan treido.account_execution_plans; status text; first_call boolean; current_object treido.media_storage_objects;
BEGIN
 SELECT * INTO effect FROM treido.account_lifecycle_effects WHERE id=e;
 IF t IS NULL THEN RAISE EXCEPTION 'Lifecycle claim token required' USING ERRCODE='23514'; END IF;
 IF effect.id IS NULL THEN RAISE EXCEPTION 'Unknown lifecycle effect' USING ERRCODE='23514'; END IF;
 SELECT users.status INTO status FROM treido.users WHERE id=effect.user_id AND clerk_subject=effect.subject FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lifecycle subject mismatch' USING ERRCODE='23514'; END IF;
 IF effect.plan_id IS NOT NULL THEN
  SELECT * INTO plan FROM treido.account_execution_plans WHERE id=effect.plan_id AND user_id=effect.user_id FOR UPDATE;
  IF plan.accepted_at IS NULL OR plan.state NOT IN('accepted','processing','blocked','reconciling') OR effect.binding_id<>plan.binding_id OR effect.subject IS DISTINCT FROM plan.payload->>'subject' OR status<>'restricted' OR NOT EXISTS(SELECT 1 FROM treido.outbox_jobs o JOIN treido.job_effects f ON f.job_id=o.id WHERE o.id=j AND o.kind='account.closure' AND o.authority='closure' AND o.seller_id IS NULL AND o.buyer_id=effect.user_id AND o.actor_id IS NULL AND o.resource_id=plan.id AND o.operation_key=plan.acceptance_key AND f.state='running' AND f.execution_token=execution AND f.execution_until>clock_timestamp()) THEN RAISE EXCEPTION 'Closure lease authority denied' USING ERRCODE='23514'; END IF;
 ELSE
  IF status<>'active' OR j IS NOT NULL OR execution IS NOT NULL THEN RAISE EXCEPTION 'Security authority denied' USING ERRCODE='23514'; END IF;
 END IF;
 SELECT * INTO effect FROM treido.account_lifecycle_effects WHERE id=e FOR UPDATE;
 IF effect.state='confirmed' THEN RETURN jsonb_build_object('claimed',false,'confirmed',true); END IF;
 IF effect.due_at>clock_timestamp() OR effect.lease_until>clock_timestamp() THEN RETURN jsonb_build_object('claimed',false,'confirmed',false); END IF;
 PERFORM 1 FROM treido.account_lifecycle_bindings WHERE id=effect.binding_id AND approved_at<=clock_timestamp() AND revoked_at IS NULL AND (CASE WHEN effect.plan_id IS NULL THEN security_enabled ELSE closure_enabled AND assistant_lifecycle_version=treido.account_closure_extension_facts(effect.user_id)->>'assistantLifecycleVersion' AND aftercare_lifecycle_version=treido.account_closure_extension_facts(effect.user_id)->>'aftercareLifecycleVersion' END) FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lifecycle binding unavailable' USING ERRCODE='55000'; END IF;
 first_call:=effect.first_attempt_at IS NULL;
 IF effect.plan_id IS NOT NULL THEN
  PERFORM treido.account_assert_message_image_plan(effect.plan_id);
  PERFORM 1 FROM treido.account_closure_policies WHERE id=plan.policy_id AND approved_at<=clock_timestamp() AND revoked_at IS NULL AND payload=plan.payload->'policy' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Current closure policy unavailable' USING ERRCODE='55000'; END IF;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(plan.payload->'targets') target WHERE target->>'kind'=effect.kind AND target->'target'=effect.target) THEN RAISE EXCEPTION 'Frozen plan authority denied' USING ERRCODE='23514'; END IF;
  IF effect.due_at<plan.accepted_at OR EXISTS(SELECT 1 FROM jsonb_array_elements(plan.payload->'targets') target WHERE target->>'kind'=effect.kind AND target->'target'=effect.target AND effect.due_at<plan.accepted_at+make_interval(secs=>(target->>'dueSeconds')::integer)) THEN RAISE EXCEPTION 'Frozen handling deadline mismatch' USING ERRCODE='23514'; END IF;
  IF effect.kind='identity.delete' AND plan.payload->'policy'->>'identity'<>'delete' THEN RAISE EXCEPTION 'Identity removal policy denied' USING ERRCODE='23514'; END IF;
  IF effect.kind IN('identity.delete','media.delete','data.remove') AND NOT(effect.kind='media.delete' AND effect.target->>'ownerKind' IS NOT DISTINCT FROM 'message-image') AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(plan.payload->'policy'->'rules') rule WHERE rule->>'category'=CASE effect.kind WHEN 'identity.delete' THEN 'identity' WHEN 'media.delete' THEN CASE WHEN effect.target->>'ownerKind'='assistant' THEN 'assistantMedia' ELSE 'personalMedia' END ELSE effect.target->>'category' END AND rule->>'handling'='remove' AND rule->>'trigger'='closure' AND rule->>'delaySeconds' IS NOT NULL AND effect.due_at>=plan.accepted_at+make_interval(secs=>(rule->>'delaySeconds')::integer)) THEN RAISE EXCEPTION 'Reviewed handling rule denied' USING ERRCODE='23514'; END IF;
  IF first_call THEN PERFORM treido.account_lock_resources(effect.user_id);PERFORM treido.account_assert_clear(effect.user_id); END IF;
  IF effect.kind IN('identity.delete','session.revoke') AND EXISTS(SELECT 1 FROM treido.account_lifecycle_effects other WHERE other.plan_id=plan.id AND other.id<>e AND other.kind NOT IN('identity.delete','session.revoke') AND other.state<>'confirmed') THEN RETURN jsonb_build_object('claimed',false,'confirmed',false); END IF;
  IF effect.kind='identity.delete' AND EXISTS(SELECT 1 FROM treido.account_lifecycle_effects other WHERE other.plan_id=plan.id AND other.id<>e AND other.state<>'confirmed') THEN RETURN jsonb_build_object('claimed',false,'confirmed',false); END IF;
  UPDATE treido.account_execution_plans SET state='processing',first_effect_at=coalesce(first_effect_at,clock_timestamp()) WHERE id=plan.id;
 END IF;
 IF effect.kind='media.delete' THEN
  IF effect.target->>'ownerKind'='message-image' THEN
   PERFORM treido.account_claim_message_image(e,t);
  ELSIF effect.target->>'ownerKind'='assistant' THEN
   IF treido.account_closure_claim_assistant_object(effect.user_id,effect.plan_id,e,t) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Assistant object lifecycle held' USING ERRCODE='55000'; END IF;
  ELSE
  SELECT * INTO current_object FROM treido.media_storage_objects WHERE storage_scope=effect.target->>'storageScope' AND object_key=effect.target->>'objectKey' FOR UPDATE;
  IF current_object.asset_id::text IS DISTINCT FROM effect.target->>'assetId' OR current_object.seller_id::text IS DISTINCT FROM effect.target->>'sellerId' OR current_object.write_until>clock_timestamp() OR current_object.retain_until>clock_timestamp() OR NOT EXISTS(SELECT 1 FROM treido.personal_seller_owners o JOIN treido.seller_accounts s ON s.id=o.seller_id WHERE o.user_id=effect.user_id AND o.seller_id=current_object.seller_id AND s.kind='personal' AND s.status='restricted') OR EXISTS(SELECT 1 FROM treido.media_assets a JOIN treido.outbox_jobs o ON o.id=a.job_id WHERE a.id=current_object.asset_id AND a.state='processing' AND o.state NOT IN('dead','cancelled','completed')) THEN RAISE EXCEPTION 'Media lifecycle held' USING ERRCODE='55000'; END IF;
  -- Registry tombstone prevents attachment by a late original writer.
  UPDATE treido.media_storage_objects SET state='deleting',deletion_token=t,deletion_until=clock_timestamp()+interval '60 seconds' WHERE storage_scope=current_object.storage_scope AND object_key=current_object.object_key AND state<>'deleted';
  END IF;
 END IF;
 UPDATE treido.account_lifecycle_effects SET state=CASE WHEN first_call THEN 'attempting' ELSE 'unknown' END,first_attempt_at=coalesce(first_attempt_at,clock_timestamp()),lease_token=t,lease_until=clock_timestamp()+interval '60 seconds' WHERE id=e;
 RETURN jsonb_build_object('claimed',true,'confirmed',false,'execute',first_call);
END $$;
CREATE OR REPLACE FUNCTION treido.account_record_effect(e uuid,t uuid,s text,h text,source_kind text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
DECLARE effect treido.account_lifecycle_effects;
BEGIN
 SELECT * INTO effect FROM treido.account_lifecycle_effects WHERE id=e;
 IF effect.target->>'ownerKind'='message-image' THEN PERFORM treido.account_message_image_io(e,t); END IF;
 SELECT * INTO effect FROM treido.account_lifecycle_effects WHERE id=e FOR UPDATE;
 IF effect.id IS NULL OR t IS NULL OR effect.lease_token IS NULL OR effect.lease_token IS DISTINCT FROM t OR effect.lease_until IS NULL OR effect.lease_until<=clock_timestamp() OR effect.first_attempt_at IS NULL OR effect.state NOT IN('attempting','unknown') OR s IS NULL OR s NOT IN('confirmed','unknown','blocked') OR h IS NULL OR h !~ '^[0-9a-f]{64}$' OR source_kind IS NULL OR source_kind NOT IN('provider','database') THEN RAISE EXCEPTION 'Lifecycle receipt lease denied' USING ERRCODE='23514'; END IF;
 INSERT INTO treido.account_effect_observations(effect_id,evidence_hash,state,source) VALUES(e,h,s,source_kind) ON CONFLICT DO NOTHING;
 UPDATE treido.account_lifecycle_effects SET state=s,confirmed_at=CASE WHEN s='confirmed' THEN clock_timestamp() ELSE NULL END,lease_token=NULL,lease_until=NULL WHERE id=e;
 IF effect.kind='media.delete' AND s='confirmed' THEN
  IF effect.target->>'ownerKind'='message-image' THEN
   IF source_kind<>'provider' THEN RAISE EXCEPTION 'Provider image evidence required' USING ERRCODE='23514'; END IF;
   UPDATE treido.message_attachment_objects SET state='deleted',deleted_at=clock_timestamp(),deletion_token=NULL,deletion_until=NULL WHERE storage_scope=effect.target->>'storageScope' AND object_key=effect.target->>'objectKey' AND attachment_id::text=effect.target->>'assetId' AND state='deleting' AND deletion_token=t AND deletion_until>clock_timestamp();
   IF NOT FOUND THEN RAISE EXCEPTION 'Current image acknowledgement denied' USING ERRCODE='23514'; END IF;
  ELSIF effect.target->>'ownerKind'='assistant' THEN PERFORM treido.account_closure_confirm_assistant_object(effect.user_id,effect.plan_id,e,t);
  ELSE UPDATE treido.media_storage_objects SET state='deleted',deleted_at=clock_timestamp(),deletion_token=NULL,deletion_until=NULL WHERE storage_scope=effect.target->>'storageScope' AND object_key=effect.target->>'objectKey' AND deletion_token=t; END IF;
 END IF;
 IF effect.plan_id IS NOT NULL AND s<>'confirmed' THEN UPDATE treido.account_execution_plans SET state=CASE WHEN s='unknown' THEN 'reconciling' ELSE 'blocked' END WHERE id=effect.plan_id; END IF;
END $$;

-- Legacy optional-data removal must also require a real current effect lease.
CREATE OR REPLACE FUNCTION treido.account_remove_optional_data(e uuid,t uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
DECLARE effect treido.account_lifecycle_effects; category text; plan treido.account_execution_plans;
BEGIN
 SELECT * INTO effect FROM treido.account_lifecycle_effects WHERE id=e;
 PERFORM 1 FROM treido.users WHERE id=effect.user_id AND clerk_subject=effect.subject AND status='restricted' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Current removal owner denied' USING ERRCODE='23514'; END IF;
 SELECT * INTO plan FROM treido.account_execution_plans WHERE id=effect.plan_id AND user_id=effect.user_id FOR UPDATE;
 IF plan.accepted_at IS NULL OR plan.state NOT IN('accepted','processing','blocked','reconciling') THEN RAISE EXCEPTION 'Current removal plan denied' USING ERRCODE='23514'; END IF;
 SELECT * INTO effect FROM treido.account_lifecycle_effects WHERE id=e FOR UPDATE;
 IF effect.kind IS DISTINCT FROM 'data.remove' OR effect.plan_id IS NULL OR t IS NULL OR effect.lease_token IS NULL OR effect.lease_token IS DISTINCT FROM t OR effect.lease_until IS NULL OR effect.lease_until<=clock_timestamp() OR effect.first_attempt_at IS NULL OR effect.state NOT IN('attempting','unknown') THEN RAISE EXCEPTION 'Optional removal denied' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM treido.account_closure_policies WHERE id=plan.policy_id AND approved_at<=clock_timestamp() AND revoked_at IS NULL AND payload=plan.payload->'policy' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Current removal policy unavailable' USING ERRCODE='55000'; END IF;
 PERFORM 1 FROM treido.account_lifecycle_bindings WHERE id=effect.binding_id AND approved_at<=clock_timestamp() AND revoked_at IS NULL AND closure_enabled AND assistant_lifecycle_version=treido.account_closure_extension_facts(effect.user_id)->>'assistantLifecycleVersion' AND aftercare_lifecycle_version=treido.account_closure_extension_facts(effect.user_id)->>'aftercareLifecycleVersion' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Current removal binding unavailable' USING ERRCODE='55000'; END IF;
 PERFORM treido.account_assert_clear(effect.user_id);
 category:=effect.target->>'category';
 IF category='library' THEN
  DELETE FROM treido.buyer_collection_items WHERE user_id=effect.user_id; DELETE FROM treido.buyer_collections WHERE user_id=effect.user_id; DELETE FROM treido.saved_listings WHERE user_id=effect.user_id; DELETE FROM treido.seller_follows WHERE user_id=effect.user_id; DELETE FROM treido.buyer_library_receipts WHERE user_id=effect.user_id;
 ELSIF category='cart' THEN DELETE FROM treido.buyer_cart_lines WHERE user_id=effect.user_id; DELETE FROM treido.buyer_cart_receipts WHERE user_id=effect.user_id;
 ELSIF category='profile' THEN DELETE FROM treido.seller_profiles WHERE seller_id IN(SELECT seller_id FROM treido.personal_seller_owners WHERE user_id=effect.user_id);UPDATE treido.account_lifecycle_workspaces SET locale=NULL,browse_scope=NULL WHERE user_id=effect.user_id;
 ELSIF category='searches' THEN
  DELETE FROM treido.buyer_search_notifications WHERE user_id=effect.user_id; DELETE FROM treido.buyer_search_observations WHERE user_id=effect.user_id; DELETE FROM treido.buyer_saved_search_runs WHERE user_id=effect.user_id; DELETE FROM treido.buyer_saved_search_versions WHERE user_id=effect.user_id; DELETE FROM treido.buyer_saved_search_receipts WHERE user_id=effect.user_id; DELETE FROM treido.buyer_saved_searches WHERE user_id=effect.user_id;
 ELSIF category='assistantMedia' THEN PERFORM treido.account_closure_remove_extension(effect.user_id,effect.plan_id,e,t);
 ELSE RAISE EXCEPTION 'Unsupported optional category' USING ERRCODE='23514'; END IF;
END $$;
