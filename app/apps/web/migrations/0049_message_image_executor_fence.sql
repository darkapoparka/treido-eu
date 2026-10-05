-- Additive correction to published0048: retain the exact successful claim's
-- original job execution. A later worker must never authorize an older lease.
-- No in-flight lease is backfilled from whichever worker happens to run now.
-- Old unproven leases fail closed until a genuine, replay-safe reclaim.
CREATE TABLE treido.message_image_execution_leases (
 effect_id uuid NOT NULL REFERENCES treido.account_lifecycle_effects(id),
 effect_token uuid NOT NULL,
 job_id uuid NOT NULL REFERENCES treido.outbox_jobs(id),
 execution_token uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(effect_id,effect_token)
);
CREATE TRIGGER message_image_execution_lease_immutable BEFORE UPDATE OR DELETE ON treido.message_image_execution_leases FOR EACH ROW EXECUTE FUNCTION treido.account_keep_receipt();
REVOKE ALL ON treido.message_image_execution_leases FROM PUBLIC;

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
 IF effect.kind='media.delete' AND effect.target->>'ownerKind'='message-image' THEN
  INSERT INTO treido.message_image_execution_leases(effect_id,effect_token,job_id,execution_token) VALUES(e,t,j,execution);
 END IF;
 RETURN jsonb_build_object('claimed',true,'confirmed',false,'execute',first_call);
END $$;

CREATE OR REPLACE FUNCTION treido.account_message_image_io(e uuid,t uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,treido,pg_temp AS $$
DECLARE effect treido.account_lifecycle_effects; plan treido.account_execution_plans;
BEGIN
 SELECT * INTO effect FROM treido.account_lifecycle_effects WHERE id=e;
 PERFORM 1 FROM treido.users WHERE id=effect.user_id AND clerk_subject=effect.subject AND status IN('restricted','closed') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Current image lifecycle identity denied' USING ERRCODE='23514'; END IF;
 SELECT * INTO plan FROM treido.account_execution_plans WHERE id=effect.plan_id AND user_id=effect.user_id FOR UPDATE;
 SELECT * INTO effect FROM treido.account_lifecycle_effects WHERE id=e FOR UPDATE;
 IF t IS NULL OR effect.kind IS DISTINCT FROM 'media.delete' OR effect.target->>'ownerKind' IS DISTINCT FROM 'message-image' OR effect.lease_token IS DISTINCT FROM t OR effect.lease_until IS NULL OR effect.lease_until<=clock_timestamp() OR effect.state NOT IN('attempting','unknown') OR plan.accepted_at IS NULL OR plan.state NOT IN('accepted','processing','blocked','reconciling') OR effect.binding_id<>plan.binding_id OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(plan.payload->'targets') target WHERE target->>'kind'=effect.kind AND target->'target'=effect.target) OR NOT EXISTS(SELECT 1 FROM treido.outbox_jobs j JOIN treido.job_effects lease ON lease.job_id=j.id JOIN treido.message_image_execution_leases original ON original.effect_id=e AND original.effect_token=t AND original.job_id=j.id AND original.execution_token=lease.execution_token WHERE j.kind='account.closure' AND j.authority='closure' AND j.buyer_id=effect.user_id AND j.actor_id IS NULL AND j.seller_id IS NULL AND j.resource_id=plan.id AND j.operation_key=plan.acceptance_key AND lease.state='running' AND lease.execution_until>clock_timestamp()) THEN RAISE EXCEPTION 'Original image effect lease denied' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM treido.account_lifecycle_bindings b JOIN treido.account_closure_policies p ON p.id=plan.policy_id WHERE b.id=plan.binding_id AND b.approved_at<=clock_timestamp() AND b.revoked_at IS NULL AND b.closure_enabled AND b.media_unversioned AND p.approved_at<=clock_timestamp() AND p.revoked_at IS NULL AND p.payload=plan.payload->'policy' FOR SHARE OF b,p;
 IF NOT FOUND THEN RAISE EXCEPTION 'Current image binding or policy denied' USING ERRCODE='55000'; END IF;
 PERFORM treido.account_assert_message_image_plan(plan.id);
 PERFORM treido.account_lock_resources(effect.user_id);
 IF treido.message_image_retention_reason((effect.target->>'assetId')::uuid) IS NOT NULL THEN RAISE EXCEPTION 'Current image hold' USING ERRCODE='55000'; END IF;
 PERFORM 1 FROM treido.message_attachments a JOIN treido.message_attachment_objects o ON o.attachment_id=a.id JOIN treido.message_image_tombstones tomb ON tomb.attachment_id=a.id WHERE a.id::text=effect.target->>'assetId' AND a.created_by=effect.user_id AND tomb.user_id=effect.user_id AND tomb.plan_id=plan.id AND a.storage_scope=o.storage_scope AND o.storage_scope=effect.target->>'storageScope' AND o.object_key=effect.target->>'objectKey' AND o.state='deleting' AND o.deletion_token=t AND o.deletion_until>clock_timestamp() AND o.write_until<=clock_timestamp() AND o.retain_until<=clock_timestamp() AND a.state NOT IN('uploading','processing') AND (a.upload_until IS NULL OR a.upload_until<=clock_timestamp()) FOR SHARE OF a,o;
 IF NOT FOUND THEN RAISE EXCEPTION 'Exact registered image object denied' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM treido.message_attachments a JOIN treido.message_attachment_objects o ON o.attachment_id=a.id CROSS JOIN LATERAL jsonb_array_elements(plan.payload->'messageImages'->'resources') r WHERE r->'target'=effect.target AND a.id::text=effect.target->>'assetId' AND o.storage_scope=effect.target->>'storageScope' AND o.object_key=effect.target->>'objectKey' AND (r->>'assetRevision')::integer=a.revision AND r->>'assetState'=a.state AND r->'writeUntil'=to_jsonb(o.write_until) AND r->'retainUntil'=to_jsonb(o.retain_until) AND r->'messageId'=coalesce((SELECT to_jsonb(l.message_id) FROM treido.message_attachment_links l WHERE l.attachment_id=a.id),'null'::jsonb)) THEN RAISE EXCEPTION 'Current image revision or link changed' USING ERRCODE='23514'; END IF;
END $$;

-- Existing finite EXECUTE grants remain; runtime gets no table privileges.
-- This fences stale workers. It does not cancel a storage DELETE already sent
-- before a newly arriving evidence hold; that separate release issue remains.
