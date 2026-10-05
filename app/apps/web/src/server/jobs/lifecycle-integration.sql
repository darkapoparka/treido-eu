-- UNNUMBERED original canonical addition; no policy/account/provider seed.
-- Applied0001-0033 remain immutable. Every external effect uses its original key.
ALTER TABLE treido.outbox_jobs DROP CONSTRAINT outbox_jobs_kind_check;
ALTER TABLE treido.outbox_jobs ADD CONSTRAINT outbox_jobs_kind_check CHECK(kind IN('media.process','system.probe','catalogue.import','team.invitation','payment.reconcile','payment.refund','buyer.saved-search','billing.reconcile','promotion.reconcile','payment.aftercare','assistant.media-expiry','assistant.run-expiry','assistant.usage','account.closure'));
ALTER TABLE treido.outbox_jobs DROP CONSTRAINT outbox_jobs_authority_check;
ALTER TABLE treido.outbox_jobs ADD CONSTRAINT outbox_jobs_authority_check CHECK(authority IN('member','service','buyer','assistant','closure'));
ALTER TABLE treido.outbox_jobs DROP CONSTRAINT outbox_actor_authority;
ALTER TABLE treido.outbox_jobs ADD CONSTRAINT outbox_actor_authority CHECK((authority='member' AND actor_id IS NOT NULL) OR (authority='service' AND actor_id IS NULL) OR (authority='buyer' AND actor_id IS NOT NULL AND actor_id=buyer_id) OR (authority IN('assistant','closure') AND actor_id IS NULL));
ALTER TABLE treido.outbox_jobs DROP CONSTRAINT outbox_owner_scope;
ALTER TABLE treido.outbox_jobs ADD CONSTRAINT outbox_owner_scope CHECK(
 (kind='buyer.saved-search' AND seller_id IS NULL AND buyer_id IS NOT NULL AND actor_id=buyer_id AND authority='buyer') OR
 (kind IN('assistant.media-expiry','assistant.run-expiry','assistant.usage') AND seller_id IS NULL AND buyer_id IS NOT NULL AND actor_id IS NULL AND authority='assistant' AND operation_key=resource_id) OR
 (kind='account.closure' AND seller_id IS NULL AND buyer_id IS NOT NULL AND actor_id IS NULL AND authority='closure') OR
 (kind NOT IN('buyer.saved-search','assistant.media-expiry','assistant.run-expiry','assistant.usage','account.closure') AND seller_id IS NOT NULL AND buyer_id IS NULL AND authority IN('member','service')));

-- Fixed finite UUID-only intent shape matches original inputHash's sorted JSON.
CREATE FUNCTION treido.lifecycle_intent_hash(k text,u uuid,r uuid,o uuid) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,treido AS $$
 SELECT encode(sha256(convert_to('{"actorId":null,"authority":'||to_json(CASE WHEN k='account.closure' THEN 'closure' ELSE 'assistant' END)::text||',"buyerId":'||to_json(u)::text||',"kind":'||to_json(k)::text||',"operationKey":'||to_json(o)::text||',"resourceId":'||to_json(r)::text||',"sellerId":null}','UTF8')),'hex')
$$;
CREATE FUNCTION treido.guard_lifecycle_outbox() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
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
   IF NOT EXISTS(SELECT 1 FROM treido.assistant_runs r JOIN treido.assistant_run_reservations b ON b.run_id=r.id AND b.user_id=r.user_id WHERE r.id=NEW.resource_id AND r.user_id=NEW.buyer_id AND CASE WHEN NEW.kind='assistant.run-expiry' THEN r.expires_at<=clock_timestamp() ELSE r.emission_started_at IS NOT NULL AND r.provider_id IS NOT NULL AND r.mode<>'voice' END) THEN RAISE EXCEPTION 'Original assistant maintenance artifact unavailable' USING ERRCODE='23514'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER lifecycle_outbox_original BEFORE INSERT OR UPDATE ON treido.outbox_jobs FOR EACH ROW EXECUTE FUNCTION treido.guard_lifecycle_outbox();

-- Private shared queue primitive. Only the reviewed finite entry functions call it.
CREATE FUNCTION treido.queue_original_lifecycle(k text,u uuid,r uuid,o uuid,next_at timestamptz) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
DECLARE original treido.outbox_jobs; effect treido.job_effects; new_id uuid; hash text;
BEGIN
 IF k NOT IN('assistant.media-expiry','assistant.run-expiry','assistant.usage','account.closure') OR u IS NULL OR r IS NULL OR o IS NULL OR next_at IS NULL THEN RAISE EXCEPTION 'Invalid lifecycle queue scope' USING ERRCODE='23514'; END IF;
 hash:=treido.lifecycle_intent_hash(k,u,r,o);new_id:=gen_random_uuid();
 INSERT INTO treido.outbox_jobs(id,kind,seller_id,buyer_id,resource_id,operation_key,actor_id,authority,intent_hash,available_at) VALUES(new_id,k,NULL,u,r,o,NULL,CASE WHEN k='account.closure' THEN 'closure' ELSE 'assistant' END,hash,greatest(clock_timestamp(),next_at)) ON CONFLICT(kind,operation_key) DO NOTHING;
 SELECT * INTO original FROM treido.outbox_jobs WHERE kind=k AND operation_key=o FOR UPDATE;
 IF original.intent_hash IS DISTINCT FROM hash OR original.resource_id<>r OR original.buyer_id<>u THEN RAISE EXCEPTION 'Original lifecycle queue conflict' USING ERRCODE='23514'; END IF;
 INSERT INTO treido.job_effects(job_id,kind,operation_key) VALUES(original.id,k,o) ON CONFLICT(job_id) DO NOTHING;
 SELECT * INTO effect FROM treido.job_effects WHERE job_id=original.id FOR UPDATE;
 IF original.state IN('completed','cancelled') OR effect.state IN('completed','cancelled') OR original.dispatch_until>clock_timestamp() OR effect.execution_until>clock_timestamp() THEN RETURN original.id; END IF;
 IF original.state='dead' THEN
  INSERT INTO treido.job_redrives(id,job_id,service_id,reason,from_generation,to_generation) VALUES(gen_random_uuid(),original.id,'accepted-lifecycle-repair-v1','Read or expire the exact original accepted lifecycle artifact; immutable financial/provider keys retained.',original.generation,original.generation+1);
  UPDATE treido.outbox_jobs SET state='pending',generation=generation+1,attempts=0,available_at=greatest(clock_timestamp(),next_at),progress_at=clock_timestamp(),dispatch_token=NULL,dispatch_until=NULL,executor_event_id=NULL,accepted_at=NULL,last_error=NULL WHERE id=original.id;
  UPDATE treido.job_effects SET state='pending',execution_token=NULL,execution_until=NULL WHERE job_id=original.id AND state IN('pending','running');
 END IF;
 RETURN original.id;
END $$;
CREATE FUNCTION treido.account_enqueue_closure(p uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
DECLARE plan treido.account_execution_plans; due timestamptz;
BEGIN
 SELECT * INTO plan FROM treido.account_execution_plans WHERE id=p;
 IF plan.id IS NULL THEN RAISE EXCEPTION 'Unknown accepted closure' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM treido.users WHERE id=plan.user_id AND status='restricted' AND clerk_subject=plan.payload->>'subject' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Original closure owner denied' USING ERRCODE='23514'; END IF;
 SELECT * INTO plan FROM treido.account_execution_plans WHERE id=p FOR UPDATE;
 IF plan.accepted_at IS NULL OR plan.acceptance_key IS NULL OR plan.state NOT IN('accepted','processing','blocked','reconciling') THEN RAISE EXCEPTION 'Unaccepted closure queue denied' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM treido.account_lifecycle_bindings b JOIN treido.account_closure_policies c ON c.id=plan.policy_id WHERE b.id=plan.binding_id AND b.approved_at<=clock_timestamp() AND b.revoked_at IS NULL AND b.closure_enabled AND b.assistant_lifecycle_version=treido.account_closure_extension_facts(plan.user_id)->>'assistantLifecycleVersion' AND b.aftercare_lifecycle_version=treido.account_closure_extension_facts(plan.user_id)->>'aftercareLifecycleVersion' AND c.approved_at<=clock_timestamp() AND c.revoked_at IS NULL AND c.payload=plan.payload->'policy' FOR SHARE OF b,c;
 IF NOT FOUND THEN RAISE EXCEPTION 'Current accepted closure registry unavailable' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(plan.payload->'targets') t WHERE NOT EXISTS(SELECT 1 FROM treido.account_lifecycle_effects e WHERE e.plan_id=p AND e.user_id=plan.user_id AND e.binding_id=plan.binding_id AND e.subject=plan.payload->>'subject' AND e.kind=t->>'kind' AND e.target=t->'target' AND e.due_at>=plan.accepted_at+make_interval(secs=>(t->>'dueSeconds')::integer))) OR EXISTS(SELECT 1 FROM treido.account_lifecycle_effects e WHERE e.plan_id=p AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(plan.payload->'targets') t WHERE t->>'kind'=e.kind AND t->'target'=e.target)) THEN RAISE EXCEPTION 'Frozen closure effects mismatch' USING ERRCODE='23514'; END IF;
 SELECT min(greatest(due_at,coalesce(lease_until,due_at))) INTO due FROM treido.account_lifecycle_effects WHERE plan_id=p AND state<>'confirmed';
 RETURN treido.queue_original_lifecycle('account.closure',plan.user_id,p,plan.acceptance_key,coalesce(due,clock_timestamp()));
END $$;
CREATE FUNCTION treido.account_repair_closure(batch integer) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
DECLARE item record; queued integer:=0;
BEGIN
 IF batch IS NULL OR batch<1 OR batch>20 THEN RAISE EXCEPTION 'Invalid closure repair bound' USING ERRCODE='23514'; END IF;
 FOR item IN SELECT p.id FROM treido.account_execution_plans p JOIN treido.users u ON u.id=p.user_id JOIN treido.account_lifecycle_bindings b ON b.id=p.binding_id JOIN treido.account_closure_policies c ON c.id=p.policy_id WHERE p.accepted_at IS NOT NULL AND p.state IN('accepted','processing','blocked','reconciling') AND u.status='restricted' AND u.clerk_subject=p.payload->>'subject' AND b.approved_at<=clock_timestamp() AND b.revoked_at IS NULL AND b.closure_enabled AND c.approved_at<=clock_timestamp() AND c.revoked_at IS NULL AND c.payload=p.payload->'policy' AND NOT EXISTS(SELECT 1 FROM treido.outbox_jobs j JOIN treido.job_effects e ON e.job_id=j.id WHERE j.kind='account.closure' AND j.operation_key=p.acceptance_key AND (j.state IN('pending','accepted','completed','cancelled') OR j.dispatch_until>clock_timestamp() OR e.execution_until>clock_timestamp())) ORDER BY p.accepted_at,p.id LIMIT batch LOOP
  PERFORM treido.account_enqueue_closure(item.id);queued:=queued+1;
 END LOOP;
 RETURN queued;
END $$;
CREATE FUNCTION treido.assistant_enqueue_maintenance(batch integer) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
DECLARE item record; queued integer:=0;
BEGIN
 IF batch IS NULL OR batch<1 OR batch>20 THEN RAISE EXCEPTION 'Invalid assistant maintenance bound' USING ERRCODE='23514'; END IF;
 FOR item IN
  SELECT candidate.kind,candidate.user_id,candidate.id FROM (
   SELECT 'assistant.media-expiry'::text AS kind,a.user_id,a.id FROM treido.assistant_media_assets a JOIN treido.assistant_runtime_policies p ON p.id=a.policy_id WHERE (a.expires_at<=clock_timestamp() OR a.state='cancelled') AND p.approved_at<=clock_timestamp() AND EXISTS(SELECT 1 FROM treido.assistant_media_objects o WHERE o.asset_id=a.id AND o.user_id=a.user_id AND o.state<>'deleted' AND o.write_until<=clock_timestamp() AND o.retain_until<=clock_timestamp())
   UNION ALL
   SELECT 'assistant.run-expiry',r.user_id,r.id FROM treido.assistant_runs r JOIN treido.assistant_run_reservations b ON b.run_id=r.id AND b.user_id=r.user_id WHERE r.expires_at<=clock_timestamp() AND (r.input_json IS NOT NULL OR r.proposal IS NOT NULL OR r.accepted_criteria IS NOT NULL OR r.state NOT IN('cancelled','failed') OR b.status IN('reserved','calling'))
   UNION ALL
   SELECT 'assistant.usage',r.user_id,r.id FROM treido.assistant_runs r JOIN treido.assistant_run_reservations b ON b.run_id=r.id AND b.user_id=r.user_id WHERE r.emission_started_at IS NOT NULL AND r.provider_id IS NOT NULL AND r.mode<>'voice' AND b.status IN('reserved','calling','unknown')
  ) candidate WHERE NOT EXISTS(SELECT 1 FROM treido.outbox_jobs j JOIN treido.job_effects e ON e.job_id=j.id WHERE j.kind=candidate.kind AND j.operation_key=candidate.id AND (j.state IN('pending','accepted','completed','cancelled') OR j.dispatch_until>clock_timestamp() OR e.execution_until>clock_timestamp())) ORDER BY candidate.id,candidate.kind LIMIT batch LOOP
  PERFORM 1 FROM treido.users WHERE id=item.user_id FOR UPDATE;
  PERFORM treido.queue_original_lifecycle(item.kind,item.user_id,item.id,item.id,clock_timestamp());queued:=queued+1;
 END LOOP;
 RETURN queued;
END $$;
REVOKE ALL ON FUNCTION treido.lifecycle_intent_hash(text,uuid,uuid,uuid),treido.guard_lifecycle_outbox(),treido.queue_original_lifecycle(text,uuid,uuid,uuid,timestamptz),treido.account_enqueue_closure(uuid),treido.account_repair_closure(integer),treido.assistant_enqueue_maintenance(integer) FROM PUBLIC;
