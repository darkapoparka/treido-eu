-- Additive T71 enforcement. The original acceptance function retains its locks,
-- policy/obligation checks and mutations; its accepted-state update invokes this
-- guard even when the restricted runtime calls the function directly.
CREATE FUNCTION treido.account_closure_cleanup_resources(u uuid,personal boolean,assistant boolean) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,treido,pg_temp AS $$
DECLARE resources jsonb := '[]'::jsonb; part jsonb;
BEGIN
 PERFORM 1 FROM treido.users WHERE id=u FOR UPDATE;
 PERFORM treido.account_lock_resources(u);
 IF personal THEN
  PERFORM 1 FROM treido.media_assets a JOIN treido.personal_seller_owners p ON p.seller_id=a.seller_id WHERE p.user_id=u ORDER BY a.id FOR SHARE OF a;
  PERFORM 1 FROM treido.media_storage_objects o JOIN treido.personal_seller_owners p ON p.seller_id=o.seller_id WHERE p.user_id=u AND o.state<>'deleted' ORDER BY o.storage_scope,o.object_key FOR SHARE OF o;
  SELECT coalesce(jsonb_agg(jsonb_build_object('target',jsonb_build_object('storageScope',o.storage_scope,'objectKey',o.object_key,'sellerId',o.seller_id,'assetId',o.asset_id), 'assetRevision',a.revision,'assetState',a.state,'assetScope',a.storage_scope,'immutableKey',a.immutable_key,'readyKey',a.derivative_key,'readyChecksum',a.derivative_checksum,'objectKind',o.kind,'objectState',o.state) ORDER BY o.storage_scope,o.object_key),'[]'::jsonb) INTO part
  FROM treido.media_storage_objects o JOIN treido.personal_seller_owners p ON p.seller_id=o.seller_id JOIN treido.media_assets a ON a.id=o.asset_id AND a.seller_id=o.seller_id WHERE p.user_id=u AND o.state<>'deleted';
  resources:=resources||part;
 END IF;
 IF assistant THEN
  PERFORM 1 FROM treido.assistant_media_assets a WHERE a.user_id=u ORDER BY a.id FOR SHARE;
  PERFORM 1 FROM treido.assistant_media_objects o WHERE o.user_id=u AND o.state<>'deleted' ORDER BY o.storage_scope,o.object_key FOR SHARE;
  SELECT coalesce(jsonb_agg(jsonb_build_object('target',jsonb_build_object('ownerKind','assistant','ownerUserId',o.user_id,'storageScope',o.storage_scope,'objectKey',o.object_key,'assetId',o.asset_id),'assetState',a.state,'readyKey',a.ready_key,'readyChecksum',a.ready_checksum,'immutableKey',a.immutable_key,'objectKind',o.kind,'objectState',o.state) ORDER BY o.storage_scope,o.object_key),'[]'::jsonb) INTO part
  FROM treido.assistant_media_objects o JOIN treido.assistant_media_assets a ON a.id=o.asset_id AND a.user_id=o.user_id WHERE o.user_id=u AND o.state<>'deleted';
  resources:=resources||part;
 END IF;
 RETURN resources;
END $$;

CREATE FUNCTION treido.account_guard_cleanup_acceptance() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido,pg_temp AS $$
DECLARE personal boolean; assistant boolean; resources jsonb; reviewed_targets jsonb; fresh_targets jsonb;
BEGIN
 IF OLD.state='reviewed' AND NEW.state='accepted' THEN
  SELECT EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.payload->'policy'->'rules') r WHERE r->>'category'='personalMedia' AND r->>'handling'='remove' AND r->>'trigger'='closure'),
         EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.payload->'policy'->'rules') r WHERE r->>'category'='assistantMedia' AND r->>'handling'='remove' AND r->>'trigger'='closure') INTO personal,assistant;
  IF personal OR assistant THEN
   resources:=treido.account_closure_cleanup_resources(NEW.user_id,personal,assistant);
   SELECT coalesce(jsonb_agg(t->'target' ORDER BY (t->'target')::text),'[]'::jsonb) INTO reviewed_targets FROM jsonb_array_elements(NEW.payload->'targets') t WHERE t->>'kind'='media.delete';
   SELECT coalesce(jsonb_agg(r->'target' ORDER BY (r->'target')::text),'[]'::jsonb) INTO fresh_targets FROM jsonb_array_elements(resources) r;
   IF resources IS DISTINCT FROM NEW.payload->'cleanupResources' OR reviewed_targets IS DISTINCT FROM fresh_targets THEN
    RAISE EXCEPTION 'Changed closure cleanup resources; review again' USING ERRCODE='23514';
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER account_cleanup_acceptance_guard BEFORE UPDATE OF state ON treido.account_execution_plans
FOR EACH ROW EXECUTE FUNCTION treido.account_guard_cleanup_acceptance();

-- The human update lock is acquired before seller/membership/invitation locks
-- by acceptance. Cancelling pending rows frees reserved seats; accepted receipts
-- and memberships belonging to legitimate recipients remain untouched.
CREATE FUNCTION treido.account_cancel_inactive_issuer_invitations() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido,pg_temp AS $$
BEGIN
 IF NEW.status<>'active' AND NEW.status IS DISTINCT FROM OLD.status THEN
  UPDATE treido.seller_invitations SET status='cancelled',revision=revision+1 WHERE created_by=NEW.id AND status='pending';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER account_inactive_issuer_invitations AFTER UPDATE OF status ON treido.users
FOR EACH ROW EXECUTE FUNCTION treido.account_cancel_inactive_issuer_invitations();
REVOKE ALL ON FUNCTION treido.account_closure_cleanup_resources(uuid,boolean,boolean),treido.account_guard_cleanup_acceptance(),treido.account_cancel_inactive_issuer_invitations() FROM PUBLIC;
