-- Additive exact-generation voice usage maintenance repair. No registry seeds.
-- Original0039 remains immutable; all artifact, lease and queue guards retained.
CREATE OR REPLACE FUNCTION treido.guard_lifecycle_outbox() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
DECLARE plan treido.account_execution_plans;
BEGIN
 IF TG_OP='UPDATE' AND OLD.kind IN('assistant.media-expiry','assistant.run-expiry','assistant.usage','account.closure') THEN
  IF (to_jsonb(NEW)-ARRAY['state','generation','attempts','available_at','dispatch_token','dispatch_until','executor_event_id','accepted_at','progress_at','completed_at','last_error']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','generation','attempts','available_at','dispatch_token','dispatch_until','executor_event_id','accepted_at','progress_at','completed_at','last_error']) OR NEW.generation<OLD.generation OR NEW.generation>OLD.generation+1 OR (NEW.generation<>OLD.generation AND NOT EXISTS(SELECT 1 FROM treido.job_redrives d WHERE d.job_id=OLD.id AND d.from_generation=OLD.generation AND d.to_generation=NEW.generation)) OR (OLD.state='completed' AND NEW.state<>'completed') THEN RAISE EXCEPTION 'Original accepted lifecycle job is immutable' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF NEW.kind NOT IN('assistant.media-expiry','assistant.run-expiry','assistant.usage','account.closure') THEN RETURN NEW; END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Lifecycle adoption denied' USING ERRCODE='23514'; END IF;
 IF NEW.seller_id IS NOT NULL OR NEW.buyer_id IS NULL OR NEW.actor_id IS NOT NULL OR NEW.intent_hash IS DISTINCT FROM treido.lifecycle_intent_hash(NEW.kind,NEW.buyer_id,NEW.resource_id,NEW.operation_key) THEN RAISE EXCEPTION 'Lifecycle intent mismatch' USING ERRCODE='23514'; END IF;
 IF NEW.kind='account.closure' THEN
  SELECT * INTO plan FROM treido.account_execution_plans WHERE id=NEW.resource_id AND user_id=NEW.buyer_id;
  IF plan.id IS NULL OR plan.accepted_at IS NULL OR plan.acceptance_key IS DISTINCT FROM NEW.operation_key OR plan.state NOT IN('accepted','processing','blocked','reconciling') OR NOT EXISTS(SELECT 1 FROM treido.users u JOIN treido.account_lifecycle_bindings b ON b.id=plan.binding_id JOIN treido.account_closure_policies c ON c.id=plan.policy_id WHERE u.id=NEW.buyer_id AND u.status='restricted' AND u.clerk_subject=plan.payload->>'subject' AND b.approved_at<=clock_timestamp() AND b.revoked_at IS NULL AND b.closure_enabled AND c.approved_at<=clock_timestamp() AND c.revoked_at IS NULL AND c.payload=plan.payload->'policy') THEN RAISE EXCEPTION 'Unaccepted closure job denied' USING ERRCODE='23514'; END IF;
 ELSE
  IF NEW.operation_key<>NEW.resource_id THEN RAISE EXCEPTION 'Original assistant artifact key mismatch' USING ERRCODE='23514'; END IF;
  IF NEW.kind='assistant.media-expiry' THEN
   IF NOT EXISTS(SELECT 1 FROM treido.assistant_media_assets a JOIN treido.assistant_runtime_policies p ON p.id=a.policy_id WHERE a.id=NEW.resource_id AND a.user_id=NEW.buyer_id AND (a.expires_at<=clock_timestamp() OR a.state='cancelled') AND p.approved_at<=clock_timestamp()) THEN RAISE EXCEPTION 'Original media expiry artifact unavailable' USING ERRCODE='23514'; END IF;
  ELSE
   IF NOT EXISTS(SELECT 1 FROM treido.assistant_runs r JOIN treido.assistant_run_reservations b ON b.run_id=r.id AND b.user_id=r.user_id WHERE r.id=NEW.resource_id AND r.user_id=NEW.buyer_id AND CASE WHEN NEW.kind='assistant.run-expiry' THEN r.expires_at<=clock_timestamp() ELSE r.emission_started_at IS NOT NULL AND r.provider_id IS NOT NULL END) THEN RAISE EXCEPTION 'Original assistant maintenance artifact unavailable' USING ERRCODE='23514'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION treido.assistant_enqueue_maintenance(batch integer) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
DECLARE item record; queued integer:=0;
BEGIN
 IF batch IS NULL OR batch<1 OR batch>20 THEN RAISE EXCEPTION 'Invalid assistant maintenance bound' USING ERRCODE='23514'; END IF;
 FOR item IN
  SELECT candidate.kind,candidate.user_id,candidate.id FROM (
   SELECT 'assistant.media-expiry'::text AS kind,a.user_id,a.id FROM treido.assistant_media_assets a JOIN treido.assistant_runtime_policies p ON p.id=a.policy_id WHERE (a.expires_at<=clock_timestamp() OR a.state='cancelled') AND p.approved_at<=clock_timestamp() AND EXISTS(SELECT 1 FROM treido.assistant_media_objects o WHERE o.asset_id=a.id AND o.user_id=a.user_id AND o.state<>'deleted' AND o.write_until<=clock_timestamp() AND o.retain_until<=clock_timestamp())
   UNION ALL
   SELECT 'assistant.run-expiry',r.user_id,r.id FROM treido.assistant_runs r JOIN treido.assistant_run_reservations b ON b.run_id=r.id AND b.user_id=r.user_id WHERE r.expires_at<=clock_timestamp() AND (r.input_json IS NOT NULL OR r.proposal IS NOT NULL OR r.accepted_criteria IS NOT NULL OR r.state NOT IN('cancelled','failed') OR b.status IN('reserved','calling'))
   UNION ALL
   SELECT 'assistant.usage',r.user_id,r.id FROM treido.assistant_runs r JOIN treido.assistant_run_reservations b ON b.run_id=r.id AND b.user_id=r.user_id WHERE r.emission_started_at IS NOT NULL AND r.provider_id IS NOT NULL AND b.status IN('reserved','calling','unknown')
  ) candidate WHERE NOT EXISTS(SELECT 1 FROM treido.outbox_jobs j JOIN treido.job_effects e ON e.job_id=j.id WHERE j.kind=candidate.kind AND j.operation_key=candidate.id AND (j.state IN('pending','accepted','completed','cancelled') OR j.dispatch_until>clock_timestamp() OR e.execution_until>clock_timestamp())) ORDER BY candidate.id,candidate.kind LIMIT batch LOOP
  PERFORM 1 FROM treido.users WHERE id=item.user_id FOR UPDATE;
  PERFORM treido.queue_original_lifecycle(item.kind,item.user_id,item.id,item.id,clock_timestamp());queued:=queued+1;
 END LOOP;
 RETURN queued;
END $$;
