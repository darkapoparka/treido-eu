-- Order evidence retention and irreversible image IO by a durable dispatch.
-- Holds committed first deny dispatch. Dispatch committed first cannot promise
-- retention: evidence writes conflict until the exact object is reconciled.
-- No transaction/row lock is held across a provider request. No approval seed.
CREATE TABLE treido.message_image_deletion_dispatches (
 effect_id uuid PRIMARY KEY REFERENCES treido.account_lifecycle_effects(id),
 effect_token uuid NOT NULL,
 attachment_id uuid NOT NULL REFERENCES treido.message_attachments(id),
 storage_scope text NOT NULL,
 object_key text NOT NULL,
 dispatched_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(effect_id,effect_token) REFERENCES treido.message_image_execution_leases(effect_id,effect_token)
);
CREATE INDEX message_image_dispatch_attachment ON treido.message_image_deletion_dispatches(attachment_id);
CREATE TRIGGER message_image_dispatch_immutable BEFORE UPDATE OR DELETE ON treido.message_image_deletion_dispatches FOR EACH ROW EXECUTE FUNCTION treido.account_keep_receipt();
CREATE TABLE treido.message_image_deletion_observations (
 effect_id uuid NOT NULL REFERENCES treido.message_image_deletion_dispatches(effect_id),
 effect_token uuid NOT NULL,
 evidence_hash text NOT NULL CHECK(evidence_hash ~ '^[0-9a-f]{64}$'),
 state text NOT NULL CHECK(state IN('confirmed','unknown','blocked')),
 observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(effect_id,effect_token,evidence_hash),
 FOREIGN KEY(effect_id,effect_token) REFERENCES treido.message_image_execution_leases(effect_id,effect_token)
);
CREATE TRIGGER message_image_deletion_observation_immutable BEFORE UPDATE OR DELETE ON treido.message_image_deletion_observations FOR EACH ROW EXECUTE FUNCTION treido.account_keep_receipt();
REVOKE ALL ON treido.message_image_deletion_dispatches,treido.message_image_deletion_observations FROM PUBLIC;

CREATE FUNCTION treido.account_dispatch_message_image(e uuid,t uuid) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,treido,pg_temp AS $$
BEGIN
 -- This locks the original owner and validates the current exact executor,
 -- effect, object, policy and every committed hold in the same transaction.
 PERFORM treido.account_message_image_io(e,t);
END $$;

-- Append provider facts even if the effect/job lease expired during IO. This
-- cannot acknowledge erasure, renew authority or authorize another DELETE.
CREATE FUNCTION treido.account_observe_message_image(e uuid,t uuid,s text,h text) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,treido,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM treido.message_image_deletion_dispatches d JOIN treido.account_lifecycle_effects effect ON effect.id=d.effect_id JOIN treido.message_image_execution_leases lease ON lease.effect_id=d.effect_id AND lease.effect_token=t WHERE d.effect_id=e AND d.attachment_id::text=effect.target->>'assetId' AND d.storage_scope=effect.target->>'storageScope' AND d.object_key=effect.target->>'objectKey') THEN
  RAISE EXCEPTION 'Original dispatched image observation denied' USING ERRCODE='23514';
 END IF;
 INSERT INTO treido.message_image_deletion_observations(effect_id,effect_token,state,evidence_hash) VALUES(e,t,s,h) ON CONFLICT DO NOTHING;
END $$;

CREATE FUNCTION treido.guard_message_image_evidence_dispatch() RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,treido,pg_temp AS $$
DECLARE affected uuid[]; row_data jsonb:=to_jsonb(NEW);
BEGIN
 -- Match the complete retention scope, not just the directly named image.
 SELECT array_agg(a.id ORDER BY a.id) INTO affected
 FROM treido.message_attachments a JOIN treido.conversation_threads thread ON thread.id=a.thread_id
 LEFT JOIN treido.message_attachment_links link ON link.attachment_id=a.id
 WHERE CASE TG_TABLE_NAME
 WHEN 'message_image_legal_holds' THEN
  (a.created_by=(row_data->>'user_id')::uuid OR a.id=(row_data->>'attachment_id')::uuid OR link.message_id=(row_data->>'message_id')::uuid)
 WHEN 'order_aftercare_legal_holds' THEN
  (a.created_by=(row_data->>'user_id')::uuid OR EXISTS(SELECT 1 FROM treido.paid_orders o JOIN treido.payable_quote_lines q ON q.quote_id=o.quote_id WHERE o.id=(row_data->>'order_id')::uuid AND q.listing_id=thread.listing_id AND o.buyer_id=thread.buyer_id AND o.seller_id=thread.seller_id))
 WHEN 'reports' THEN
  ((row_data->>'resource_kind'='listing' AND thread.listing_id=(row_data->>'resource_id')::uuid) OR (row_data->>'resource_kind'='message' AND EXISTS(SELECT 1 FROM treido.messages m WHERE m.id=(row_data->>'resource_id')::uuid AND m.thread_id=thread.id)))
 WHEN 'listing_offers' THEN row_data->>'state'='accepted' AND thread.id=(row_data->>'thread_id')::uuid
 WHEN 'offer_events' THEN row_data->>'kind'='accepted' AND thread.id=(row_data->>'thread_id')::uuid
 WHEN 'payment_attempts' THEN EXISTS(SELECT 1 FROM treido.payable_quote_lines q JOIN treido.payable_quotes quote ON quote.id=q.quote_id WHERE q.quote_id=(row_data->>'quote_id')::uuid AND q.listing_id=thread.listing_id AND quote.buyer_id=thread.buyer_id AND quote.seller_id=thread.seller_id)
 WHEN 'payable_quote_lines' THEN thread.listing_id=(row_data->>'listing_id')::uuid AND EXISTS(SELECT 1 FROM treido.payable_quotes quote JOIN treido.payment_attempts p ON p.quote_id=quote.id WHERE quote.id=(row_data->>'quote_id')::uuid AND quote.buyer_id=thread.buyer_id AND quote.seller_id=thread.seller_id)
 ELSE false END;
 -- Same owner mutex as dispatch, released at transaction end. A waiting hold
 -- reads the newly committed durable barrier; timeouts never erase it.
 PERFORM 1 FROM treido.users u WHERE EXISTS(SELECT 1 FROM treido.message_attachments a WHERE a.id=ANY(affected) AND a.created_by=u.id) ORDER BY u.id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM treido.message_image_deletion_dispatches d JOIN treido.message_attachment_objects o ON o.attachment_id=d.attachment_id AND o.storage_scope=d.storage_scope AND o.object_key=d.object_key WHERE d.attachment_id=ANY(affected) AND o.state<>'deleted') THEN
  RAISE EXCEPTION 'Message image deletion already dispatched; evidence retention unavailable pending exact-object reconciliation' USING ERRCODE='55000';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER message_image_evidence_dispatch AFTER INSERT OR UPDATE ON treido.message_image_legal_holds FOR EACH ROW EXECUTE FUNCTION treido.guard_message_image_evidence_dispatch();
CREATE TRIGGER message_image_evidence_dispatch AFTER INSERT OR UPDATE ON treido.order_aftercare_legal_holds FOR EACH ROW EXECUTE FUNCTION treido.guard_message_image_evidence_dispatch();
CREATE TRIGGER message_image_evidence_dispatch AFTER INSERT OR UPDATE ON treido.reports FOR EACH ROW EXECUTE FUNCTION treido.guard_message_image_evidence_dispatch();
CREATE TRIGGER message_image_evidence_dispatch AFTER INSERT OR UPDATE ON treido.listing_offers FOR EACH ROW EXECUTE FUNCTION treido.guard_message_image_evidence_dispatch();
CREATE TRIGGER message_image_evidence_dispatch AFTER INSERT OR UPDATE ON treido.offer_events FOR EACH ROW EXECUTE FUNCTION treido.guard_message_image_evidence_dispatch();
CREATE TRIGGER message_image_evidence_dispatch AFTER INSERT OR UPDATE ON treido.payment_attempts FOR EACH ROW EXECUTE FUNCTION treido.guard_message_image_evidence_dispatch();
CREATE TRIGGER message_image_evidence_dispatch AFTER INSERT OR UPDATE ON treido.payable_quote_lines FOR EACH ROW EXECUTE FUNCTION treido.guard_message_image_evidence_dispatch();
REVOKE ALL ON FUNCTION treido.account_dispatch_message_image(uuid,uuid),treido.account_observe_message_image(uuid,uuid,text,text),treido.guard_message_image_evidence_dispatch() FROM PUBLIC;

-- The existing finite IO seam also reserves dispatch, protecting mixed-version workers.
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
 INSERT INTO treido.message_image_deletion_dispatches(effect_id,effect_token,attachment_id,storage_scope,object_key)
 VALUES(e,t,(effect.target->>'assetId')::uuid,effect.target->>'storageScope',effect.target->>'objectKey')
 ON CONFLICT(effect_id) DO NOTHING;
END $$;
