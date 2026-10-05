-- ORIGINAL T67 UNNUMBERED proposal. No approved carrier, tariff, rights,
-- recipient, lifecycle, runtime, customer or supply seed. T64 alone adopts it.
CREATE FUNCTION treido.shipping_localized(v jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT coalesce(jsonb_typeof(v)='object' AND v ?& ARRAY['bg','en'] AND (v-'bg'-'en')='{}'::jsonb AND jsonb_typeof(v->'bg')='string' AND jsonb_typeof(v->'en')='string' AND length(v->>'bg') BETWEEN 1 AND 5000 AND length(v->>'en') BETWEEN 1 AND 5000,false)
$$;
CREATE TABLE treido.order_shipping_policies(
 id uuid PRIMARY KEY,version integer NOT NULL CHECK(version>0),base_policy_id uuid NOT NULL REFERENCES treido.payment_policies(id),financial_policy_id uuid NOT NULL REFERENCES treido.order_financial_policies(id),
 platform_account text NOT NULL,livemode boolean NOT NULL,environment text NOT NULL,application_id text NOT NULL,
 payload jsonb NOT NULL,terms_hash varchar(64) NOT NULL CHECK(terms_hash~'^[a-f0-9]{64}$'),
 approved_at timestamptz NOT NULL,approval_reference text NOT NULL CHECK(length(approval_reference) BETWEEN 1 AND 200),revoked_at timestamptz,
 CHECK(revoked_at IS NULL OR revoked_at>=approved_at),UNIQUE(base_policy_id,version),
 CHECK(octet_length(payload::text)<=50000 AND payload->>'version'=version::text AND payload->>'basePolicyId'=base_policy_id::text AND payload->>'financialPolicyId'=financial_policy_id::text AND payload->>'platformAccount'=platform_account AND (payload->>'livemode')::boolean=livemode AND payload->>'environment'=environment AND payload->>'applicationId'=application_id),
 CHECK((payload ?& ARRAY['version','basePolicyId','financialPolicyId','platformAccount','livemode','environment','applicationId','countries','fields','requiredFields','recipientPurpose','retentionDescription','terms','rights','refundTerms','taxDescription','taxBasis','shippingRefund','commissionBasis','quoteValidity','reviewSeconds','unacceptedRecipientSeconds','acceptedRecipientSeconds','retentionVersion']) IS TRUE),
 CHECK(treido.shipping_localized(payload->'recipientPurpose') AND treido.shipping_localized(payload->'retentionDescription') AND treido.shipping_localized(payload->'terms') AND treido.shipping_localized(payload->'rights') AND treido.shipping_localized(payload->'refundTerms') AND treido.shipping_localized(payload->'taxDescription')),
 CHECK((payload->>'taxBasis' IN('inclusive_known','inclusive_unspecified','exclusive_known') AND payload->>'commissionBasis' IN('merchandise','merchandise_and_shipping') AND payload->>'quoteValidity'='original_allocation_within_tariff' AND payload->>'retentionVersion'='order-shipping-v1' AND (payload->>'reviewSeconds')::integer BETWEEN 60 AND 3600 AND (payload->>'unacceptedRecipientSeconds')::integer BETWEEN (payload->>'reviewSeconds')::integer AND 31536000 AND (payload->>'acceptedRecipientSeconds')::integer BETWEEN 60 AND 315360000) IS TRUE),
 CHECK((payload->'shippingRefund' ?& ARRAY['beforeDispatch','afterDispatch','return'] AND payload->'shippingRefund'->>'beforeDispatch' IN('refundable','not_refundable') AND payload->'shippingRefund'->>'afterDispatch' IN('refundable','not_refundable') AND payload->'shippingRefund'->>'return' IN('refundable','not_refundable')) IS TRUE)
);
CREATE TABLE treido.order_shipping_carriers(
 id uuid PRIMARY KEY,policy_id uuid NOT NULL REFERENCES treido.order_shipping_policies(id),seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id),version integer NOT NULL CHECK(version>0),payload jsonb NOT NULL,binding_hash varchar(64) NOT NULL CHECK(binding_hash~'^[a-f0-9]{64}$'),
 approved_at timestamptz NOT NULL,approval_reference text NOT NULL CHECK(length(approval_reference) BETWEEN 1 AND 200),revoked_at timestamptz,CHECK(revoked_at IS NULL OR revoked_at>=approved_at),UNIQUE(policy_id,seller_id,version),UNIQUE(id,policy_id),
 CHECK((octet_length(payload::text)<=10000 AND payload->>'policyId'=policy_id::text AND payload->>'sellerId'=seller_id::text AND payload->>'version'=version::text AND payload->>'country'~'^[A-Z]{2}$' AND payload->>'method' IN('address','collection_office') AND payload->>'sourceKind'='approved_seller_tariff' AND length(payload->>'carrierCode') BETWEEN 1 AND 80 AND treido.shipping_localized(payload->'carrierLabel')) IS TRUE),
 CHECK((CASE payload->>'method' WHEN 'address' THEN payload->'officeCodes'='null'::jsonb WHEN 'collection_office' THEN jsonb_typeof(payload->'officeCodes')='array' AND jsonb_array_length(payload->'officeCodes') BETWEEN 1 AND 100 ELSE false END) IS TRUE)
);
CREATE TABLE treido.order_shipping_rates(
 id uuid PRIMARY KEY,policy_id uuid NOT NULL REFERENCES treido.order_shipping_policies(id),carrier_binding_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),payload jsonb NOT NULL,rate_hash varchar(64) NOT NULL CHECK(rate_hash~'^[a-f0-9]{64}$'),valid_until timestamptz NOT NULL,
 approved_at timestamptz NOT NULL,approval_reference text NOT NULL CHECK(length(approval_reference) BETWEEN 1 AND 200),revoked_at timestamptz,CHECK(revoked_at IS NULL OR revoked_at>=approved_at),CHECK(valid_until>approved_at),UNIQUE(carrier_binding_id,version),FOREIGN KEY(carrier_binding_id,policy_id) REFERENCES treido.order_shipping_carriers(id,policy_id),
 CHECK((octet_length(payload::text)<=10000 AND payload->>'bindingId'=carrier_binding_id::text AND payload->>'version'=version::text AND (payload->>'validUntil')::timestamptz=valid_until AND (payload->>'shippingMinor')::integer BETWEEN 0 AND 99999999 AND (payload->>'buyerFeeMinor')::integer BETWEEN 0 AND 99999999 AND (payload->>'maximumUnits')::integer BETWEEN 1 AND 3000000 AND (payload->>'maximumMerchandiseMinor')::integer BETWEEN 1 AND 99999999 AND length(payload->>'sourceReference') BETWEEN 1 AND 200) IS TRUE),
 CHECK(((payload->>'taxBasis'='inclusive_unspecified' AND payload->'taxMinor'='null'::jsonb AND payload->'sourceHash'='null'::jsonb AND payload->'merchandiseMinor'='null'::jsonb) OR (payload->>'taxBasis' IN('inclusive_known','exclusive_known') AND (payload->>'taxMinor')::integer BETWEEN 0 AND 99999999 AND payload->>'sourceHash'~'^[a-f0-9]{64}$' AND (payload->>'merchandiseMinor')::integer BETWEEN 1 AND 99999999)) IS TRUE)
);
CREATE TABLE treido.order_shipping_choices(
 id uuid PRIMARY KEY,buyer_id uuid NOT NULL REFERENCES treido.users(id),seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id),snapshot jsonb NOT NULL,snapshot_hash varchar(64) NOT NULL CHECK(snapshot_hash~'^[a-f0-9]{64}$'),
 state text NOT NULL DEFAULT 'reviewed' CHECK(state IN('reviewed','accepted','bound')),revision integer NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 2),
 expires_at timestamptz NOT NULL,accepted_at timestamptz,bound_at timestamptz,quote_id uuid UNIQUE REFERENCES treido.payable_quotes(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK((octet_length(snapshot::text)<=150000 AND snapshot->>'format'='goods-shipping-v1' AND snapshot->>'currency'='EUR' AND snapshot->>'language' IN('bg','en') AND snapshot->>'sellerId'=seller_id::text AND snapshot->>'sourceHash'~'^[a-f0-9]{64}$' AND jsonb_typeof(snapshot->'lines')='array' AND jsonb_array_length(snapshot->'lines') BETWEEN 1 AND 30) IS TRUE),
 CHECK(expires_at>created_at),CHECK(accepted_at IS NULL OR accepted_at BETWEEN created_at AND expires_at),
 CHECK((state='reviewed' AND revision=0 AND accepted_at IS NULL AND quote_id IS NULL AND bound_at IS NULL) OR (state='accepted' AND revision=1 AND accepted_at IS NOT NULL AND quote_id IS NULL AND bound_at IS NULL) OR (state='bound' AND revision=2 AND accepted_at IS NOT NULL AND quote_id IS NOT NULL AND bound_at BETWEEN accepted_at AND expires_at))
);
CREATE TABLE treido.order_shipping_recipients(
 choice_id uuid PRIMARY KEY REFERENCES treido.order_shipping_choices(id),buyer_id uuid NOT NULL REFERENCES treido.users(id),value jsonb,retain_until timestamptz NOT NULL,cleared_at timestamptz,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK(value IS NULL OR (jsonb_typeof(value)='object' AND octet_length(value::text)<=2000)),CHECK((value IS NULL)=(cleared_at IS NOT NULL)),CHECK(retain_until>created_at)
);
CREATE TABLE treido.order_shipping_receipts(
 buyer_id uuid NOT NULL REFERENCES treido.users(id),request_id uuid NOT NULL,choice_id uuid REFERENCES treido.order_shipping_choices(id),input_hash varchar(64),action text NOT NULL CHECK(action IN('prepare','accept','abandoned')),accepted_revision integer NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(buyer_id,request_id),
 CHECK((action='abandoned' AND choice_id IS NULL AND input_hash IS NULL AND accepted_revision=0) OR (action IN('prepare','accept') AND choice_id IS NOT NULL AND input_hash~'^[a-f0-9]{64}$' AND accepted_revision=CASE action WHEN 'prepare' THEN 0 ELSE 1 END))
);
CREATE INDEX order_shipping_own_history ON treido.order_shipping_choices(buyer_id,created_at DESC,id DESC);
CREATE INDEX order_shipping_due_private ON treido.order_shipping_recipients(retain_until,choice_id) WHERE value IS NOT NULL;
CREATE FUNCTION treido.guard_shipping_registry() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Shipping approval history cannot be deleted' USING ERRCODE='23514'; END IF;
 IF (to_jsonb(NEW)-'revoked_at') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at') OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at) OR NEW.revoked_at<OLD.approved_at THEN RAISE EXCEPTION 'Shipping approval is immutable' USING ERRCODE='23514'; END IF;RETURN NEW;
END $$;
CREATE TRIGGER shipping_policy_immutable BEFORE UPDATE OR DELETE ON treido.order_shipping_policies FOR EACH ROW EXECUTE FUNCTION treido.guard_shipping_registry();
CREATE TRIGGER shipping_carrier_immutable BEFORE UPDATE OR DELETE ON treido.order_shipping_carriers FOR EACH ROW EXECUTE FUNCTION treido.guard_shipping_registry();
CREATE TRIGGER shipping_rate_immutable BEFORE UPDATE OR DELETE ON treido.order_shipping_rates FOR EACH ROW EXECUTE FUNCTION treido.guard_shipping_registry();
CREATE FUNCTION treido.check_shipping_policy_shape() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
DECLARE field text;
BEGIN
 IF jsonb_typeof(NEW.payload->'fields') IS DISTINCT FROM 'array' OR jsonb_typeof(NEW.payload->'requiredFields') IS DISTINCT FROM 'array' OR jsonb_typeof(NEW.payload->'countries') IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.payload->'fields') NOT BETWEEN 1 AND 6 OR jsonb_array_length(NEW.payload->'countries') NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Shipping recipient/country shape unavailable' USING ERRCODE='23514'; END IF;
 IF (SELECT count(*)<>count(DISTINCT value) FROM jsonb_array_elements_text(NEW.payload->'fields')) OR (SELECT count(*)<>count(DISTINCT value) FROM jsonb_array_elements_text(NEW.payload->'requiredFields')) OR (SELECT count(*)<>count(DISTINCT value) FROM jsonb_array_elements_text(NEW.payload->'countries')) THEN RAISE EXCEPTION 'Duplicate shipping fields/countries' USING ERRCODE='23514'; END IF;
 FOR field IN SELECT jsonb_array_elements_text(NEW.payload->'fields') LOOP IF field NOT IN('name','phone','address','city','postalCode','officeCode') THEN RAISE EXCEPTION 'Unsupported shipping recipient field' USING ERRCODE='23514'; END IF; END LOOP;
 FOR field IN SELECT jsonb_array_elements_text(NEW.payload->'requiredFields') LOOP IF NOT NEW.payload->'fields' ? field THEN RAISE EXCEPTION 'Required shipping field is not allowed' USING ERRCODE='23514'; END IF; END LOOP;
 FOR field IN SELECT jsonb_array_elements_text(NEW.payload->'countries') LOOP IF field!~'^[A-Z]{2}$' THEN RAISE EXCEPTION 'Invalid shipping country' USING ERRCODE='23514'; END IF; END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER shipping_policy_shape BEFORE INSERT ON treido.order_shipping_policies FOR EACH ROW EXECUTE FUNCTION treido.check_shipping_policy_shape();
CREATE FUNCTION treido.guard_shipping_choice() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
DECLARE p treido.order_shipping_policies; c treido.order_shipping_carriers; r treido.order_shipping_rates; f treido.order_financial_policies; base treido.payment_policies; costs jsonb; merchandise bigint; charge bigint; commission bigint;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Shipping accepted history cannot be deleted' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)-ARRAY['state','revision','accepted_at','bound_at','quote_id']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['state','revision','accepted_at','bound_at','quote_id']) THEN RAISE EXCEPTION 'Shipping snapshot is immutable' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND NOT ((OLD.state='reviewed' AND NEW.state='accepted' AND NEW.revision=1 AND NEW.quote_id IS NULL) OR (OLD.state='accepted' AND NEW.state='bound' AND NEW.revision=2 AND NEW.accepted_at=OLD.accepted_at)) THEN RAISE EXCEPTION 'Shipping transition denied' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM treido.users WHERE id=NEW.buyer_id AND status='active' FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'Shipping current buyer unavailable' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM treido.seller_accounts WHERE id=NEW.seller_id AND status='active' FOR SHARE; IF NOT FOUND THEN RAISE EXCEPTION 'Shipping current seller unavailable' USING ERRCODE='23514'; END IF;
 SELECT * INTO p FROM treido.order_shipping_policies WHERE id=(NEW.snapshot->'option'->'policy'->>'id')::uuid AND approved_at<=clock_timestamp() AND revoked_at IS NULL FOR SHARE;
 SELECT * INTO c FROM treido.order_shipping_carriers WHERE id=(NEW.snapshot->'option'->'binding'->>'id')::uuid AND policy_id=p.id AND seller_id=NEW.seller_id AND approved_at<=clock_timestamp() AND revoked_at IS NULL FOR SHARE;
 SELECT * INTO r FROM treido.order_shipping_rates WHERE id=(NEW.snapshot->'option'->'rate'->>'id')::uuid AND policy_id=p.id AND carrier_binding_id=c.id AND approved_at<=clock_timestamp() AND revoked_at IS NULL AND valid_until>clock_timestamp() FOR SHARE;
 SELECT * INTO f FROM treido.order_financial_policies WHERE id=p.financial_policy_id AND base_policy_id=p.base_policy_id AND platform_account=p.platform_account AND livemode=p.livemode AND environment=p.environment AND application_id=p.application_id AND method='shipping' AND tracking_allowed AND approved_at<=clock_timestamp() AND revoked_at IS NULL FOR SHARE;
 SELECT * INTO base FROM treido.payment_policies WHERE id=p.base_policy_id AND platform_account=p.platform_account AND livemode=p.livemode AND environment=p.environment AND application_id=p.application_id AND approved_at<=clock_timestamp() AND revoked_at IS NULL FOR SHARE;
 IF p.id IS NULL OR c.id IS NULL OR r.id IS NULL OR f.id IS NULL OR base.id IS NULL OR NEW.snapshot->'option'->'policy' IS DISTINCT FROM (p.payload||jsonb_build_object('id',p.id,'termsHash',p.terms_hash)) OR NEW.snapshot->'option'->'binding' IS DISTINCT FROM (c.payload||jsonb_build_object('id',c.id,'bindingHash',c.binding_hash)) OR NEW.snapshot->'option'->'rate' IS DISTINCT FROM (r.payload||jsonb_build_object('id',r.id,'rateHash',r.rate_hash)) OR NEW.snapshot->'option'->'financial' IS DISTINCT FROM jsonb_build_object('id',f.id,'version',f.version,'termsHash',f.terms_hash,'terms',f.terms,'retentionDescription',f.recipient_retention_description) OR NEW.snapshot->>'country' IS DISTINCT FROM c.payload->>'country' OR NOT p.payload->'countries' ? (NEW.snapshot->>'country') OR r.payload->>'taxBasis' IS DISTINCT FROM p.payload->>'taxBasis' OR p.payload->>'taxBasis' IS DISTINCT FROM f.tax_basis OR f.tax_basis<>'inclusive_unspecified' OR (r.payload->>'buyerFeeMinor')::integer<>0 OR NEW.expires_at>r.valid_until THEN RAISE EXCEPTION 'Shipping approved supported original contract unavailable' USING ERRCODE='23514'; END IF;
 SELECT sum((line->>'quantity')::bigint*(line->>'unitPriceMinor')::bigint) INTO merchandise FROM jsonb_array_elements(NEW.snapshot->'lines') line;
 IF r.payload->>'taxBasis'<>'inclusive_unspecified' AND (r.payload->>'sourceHash' IS DISTINCT FROM NEW.snapshot->>'sourceHash' OR (r.payload->>'merchandiseMinor')::bigint IS DISTINCT FROM merchandise) THEN RAISE EXCEPTION 'Shipping numeric tax source mismatch' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.snapshot->'lines') line WHERE (line->>'quantity')::integer NOT BETWEEN 1 AND 100000 OR (line->>'unitPriceMinor')::integer NOT BETWEEN 0 AND 99999999) OR (SELECT sum((line->>'quantity')::bigint) FROM jsonb_array_elements(NEW.snapshot->'lines') line)>(r.payload->>'maximumUnits')::integer OR (NEW.snapshot->>'originalSourceExpiresAt' IS NOT NULL AND NEW.expires_at>(NEW.snapshot->>'originalSourceExpiresAt')::timestamptz) THEN RAISE EXCEPTION 'Shipping original quantity/deadline denied' USING ERRCODE='23514'; END IF;
 costs:=NEW.snapshot->'option'->'costs'; charge:=merchandise+(r.payload->>'shippingMinor')::integer+(r.payload->>'buyerFeeMinor')::integer+CASE WHEN r.payload->>'taxBasis'='exclusive_known' THEN (r.payload->>'taxMinor')::integer ELSE 0 END;
 commission:=merchandise+CASE WHEN p.payload->>'commissionBasis'='merchandise_and_shipping' THEN (r.payload->>'shippingMinor')::integer ELSE 0 END;
 IF merchandise NOT BETWEEN 1 AND (r.payload->>'maximumMerchandiseMinor')::integer OR (costs->>'merchandiseMinor')::bigint IS DISTINCT FROM merchandise OR (costs->>'shippingMinor')::integer IS DISTINCT FROM (r.payload->>'shippingMinor')::integer OR (costs->>'buyerFeeMinor')::integer IS DISTINCT FROM (r.payload->>'buyerFeeMinor')::integer OR costs->'taxMinor' IS DISTINCT FROM r.payload->'taxMinor' OR costs->>'taxBasis' IS DISTINCT FROM r.payload->>'taxBasis' OR (costs->>'totalMinor')::bigint IS DISTINCT FROM charge OR charge NOT BETWEEN 50 AND 99999999 OR (costs->>'applicationFeeMinor')::bigint IS DISTINCT FROM ((commission*base.fee_bps+5000)/10000+base.fee_fixed_minor) THEN RAISE EXCEPTION 'Shipping original arithmetic denied' USING ERRCODE='23514'; END IF;
 IF TG_OP='INSERT' AND (NEW.state<>'reviewed' OR NEW.revision<>0) THEN RAISE EXCEPTION 'Explicit shipping review required' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND (NEW.expires_at<=clock_timestamp() OR NOT EXISTS(SELECT 1 FROM treido.order_shipping_recipients private WHERE private.choice_id=NEW.id AND private.buyer_id=NEW.buyer_id AND private.value IS NOT NULL AND private.retain_until>clock_timestamp())) THEN RAISE EXCEPTION 'Shipping recipient/deadline unavailable' USING ERRCODE='23514'; END IF;
 IF NEW.state='bound' AND NOT EXISTS(SELECT 1 FROM treido.payable_quotes q JOIN treido.inventory_allocations a ON a.id=q.allocation_id JOIN treido.quote_aftercare_acceptances acceptance ON acceptance.quote_id=q.id WHERE q.id=NEW.quote_id AND q.buyer_id=NEW.buyer_id AND q.seller_id=NEW.seller_id AND q.currency='EUR' AND q.policy_id=p.base_policy_id AND q.platform_account=p.platform_account AND q.livemode=p.livemode AND q.language=NEW.snapshot->>'language' AND q.total_minor=charge AND q.application_fee_minor=(costs->>'applicationFeeMinor')::integer AND q.expires_at<=r.valid_until AND q.expires_at=a.expires_at AND a.buyer_id=q.buyer_id AND a.seller_id=q.seller_id AND a.state='active' AND a.expires_at>clock_timestamp() AND (NEW.snapshot->>'allocationId' IS NULL OR (a.id=(NEW.snapshot->>'allocationId')::uuid AND to_char(a.expires_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')=(NEW.snapshot->>'originalSourceExpiresAt'))) AND acceptance.buyer_id=q.buyer_id AND acceptance.policy_id=f.id AND acceptance.version=f.version AND acceptance.terms_hash=f.terms_hash AND acceptance.language=q.language AND q.terms_snapshot->>'handover'='shipping' AND q.terms_snapshot->'shipping'->'choice'->>'id'=NEW.id::text AND q.terms_snapshot->'shipping'->'choice'->>'snapshotHash'=NEW.snapshot_hash AND q.terms_snapshot->'shipping'->'costs'=costs) THEN RAISE EXCEPTION 'Shipping original quote/aftercare correlation denied' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER shipping_choice_authority BEFORE INSERT OR UPDATE OR DELETE ON treido.order_shipping_choices FOR EACH ROW EXECUTE FUNCTION treido.guard_shipping_choice();
CREATE FUNCTION treido.guard_shipping_recipient() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
DECLARE choice treido.order_shipping_choices; p jsonb; field text; data text; allowed boolean;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Shipping recipient removal needs reviewed lifecycle' USING ERRCODE='23514'; END IF;
 SELECT * INTO choice FROM treido.order_shipping_choices WHERE id=NEW.choice_id AND buyer_id=NEW.buyer_id; p:=choice.snapshot->'option'->'policy';
 IF choice.id IS NULL THEN RAISE EXCEPTION 'Shipping recipient owner denied' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.choice_id<>OLD.choice_id OR NEW.buyer_id<>OLD.buyer_id OR NEW.created_at<>OLD.created_at OR OLD.value IS NULL THEN RAISE EXCEPTION 'Shipping recipient cannot be replaced or restored' USING ERRCODE='23514'; END IF;
  IF NEW.value IS NULL THEN
   IF OLD.retain_until>clock_timestamp() OR NEW.retain_until<>OLD.retain_until OR NEW.cleared_at IS NULL THEN RAISE EXCEPTION 'Shipping recipient is held' USING ERRCODE='23514'; END IF;
   IF choice.quote_id IS NOT NULL THEN
    IF to_regprocedure('treido.order_shipping_accepted_clear_allowed(uuid)') IS NULL THEN RAISE EXCEPTION 'Accepted shipping removal is unregistered' USING ERRCODE='23514'; END IF;
    EXECUTE 'SELECT treido.order_shipping_accepted_clear_allowed($1)' INTO allowed USING choice.id;
    IF allowed IS DISTINCT FROM true THEN RAISE EXCEPTION 'Accepted shipping original lease denied' USING ERRCODE='23514'; END IF;
   ELSIF choice.expires_at>clock_timestamp() THEN RAISE EXCEPTION 'Shipping original input is held' USING ERRCODE='23514'; END IF;
   RETURN NEW;
  END IF;
  IF NEW.value IS DISTINCT FROM OLD.value OR NEW.cleared_at IS DISTINCT FROM OLD.cleared_at OR choice.state<>'bound' OR NEW.retain_until IS DISTINCT FROM choice.bound_at+make_interval(secs=>(p->>'acceptedRecipientSeconds')::integer) THEN RAISE EXCEPTION 'Shipping retention binding denied' USING ERRCODE='23514'; END IF;
 ELSE
  IF choice.state<>'reviewed' OR NEW.value IS NULL OR NEW.retain_until>NEW.created_at+make_interval(secs=>(p->>'unacceptedRecipientSeconds')::integer) THEN RAISE EXCEPTION 'Explicit shipping recipient review required' USING ERRCODE='23514'; END IF;
 END IF;
 IF NEW.value='{}'::jsonb THEN RAISE EXCEPTION 'Empty shipping recipient denied' USING ERRCODE='23514'; END IF;
 IF choice.snapshot->'option'->'binding'->>'method'='collection_office' AND NOT (choice.snapshot->'option'->'binding'->'officeCodes' ? (NEW.value->>'officeCode')) THEN RAISE EXCEPTION 'Shipping reviewed collection office required' USING ERRCODE='23514'; END IF;
 FOR field,data IN SELECT key,value FROM jsonb_each_text(NEW.value) LOOP IF NOT p->'fields' ? field OR jsonb_typeof(NEW.value->field) IS DISTINCT FROM 'string' OR length(data) NOT BETWEEN 1 AND (CASE field WHEN 'address' THEN 300 WHEN 'phone' THEN 40 ELSE 100 END) OR data~'[[:cntrl:]]' THEN RAISE EXCEPTION 'Shipping recipient field denied' USING ERRCODE='23514'; END IF; END LOOP;
 FOR field IN SELECT jsonb_array_elements_text(p->'requiredFields') LOOP IF NOT NEW.value ? field THEN RAISE EXCEPTION 'Shipping recipient field missing' USING ERRCODE='23514'; END IF; END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER shipping_recipient_authority BEFORE INSERT OR UPDATE OR DELETE ON treido.order_shipping_recipients FOR EACH ROW EXECUTE FUNCTION treido.guard_shipping_recipient();
CREATE FUNCTION treido.guard_shipping_receipt() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Shipping original request receipt is immutable' USING ERRCODE='23514'; END IF;
 IF NEW.choice_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM treido.order_shipping_choices c WHERE c.id=NEW.choice_id AND c.buyer_id=NEW.buyer_id AND c.revision=NEW.accepted_revision) THEN RAISE EXCEPTION 'Shipping receipt owner/revision mismatch' USING ERRCODE='23514'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER shipping_receipt_immutable BEFORE INSERT OR UPDATE OR DELETE ON treido.order_shipping_receipts FOR EACH ROW EXECUTE FUNCTION treido.guard_shipping_receipt();

-- Per-original-artifact handler for the EXISTING canonical signed executor.
-- The canonical owner must register this finite kind and add it to existing
-- maintenance/closure aggregation; absent registration keeps recipient writes closed.
CREATE FUNCTION treido.order_shipping_input_intent_hash(u uuid,c uuid) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT encode(sha256(convert_to('{"actorId":null,"authority":"shipping","buyerId":'||to_json(u)::text||',"kind":"shipping.input-expiry","operationKey":'||to_json(c)::text||',"resourceId":'||to_json(c)::text||',"sellerId":null}','UTF8')),'hex')
$$;
CREATE FUNCTION treido.order_shipping_expire_input(j uuid,u uuid,c uuid,g integer,t uuid,executor_app text,executor_env text,backend_env text,clerk_app text,clerk_mode_value text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
DECLARE choice treido.order_shipping_choices; private treido.order_shipping_recipients; p treido.order_shipping_policies; mapped boolean;
BEGIN
 IF j IS NULL OR u IS NULL OR c IS NULL OR t IS NULL OR g IS NULL OR g<1 OR executor_app IS NULL OR executor_env IS NULL OR backend_env IS NULL OR clerk_app IS NULL OR clerk_mode_value IS NULL THEN RAISE EXCEPTION 'Shipping expiry original scope missing' USING ERRCODE='23514'; END IF;
 PERFORM 1 FROM treido.users WHERE id=u FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Shipping expiry owner denied' USING ERRCODE='23514'; END IF;
 SELECT * INTO choice FROM treido.order_shipping_choices WHERE id=c AND buyer_id=u FOR UPDATE;
 SELECT * INTO private FROM treido.order_shipping_recipients WHERE choice_id=c AND buyer_id=u FOR UPDATE;
 IF choice.id IS NULL OR private.choice_id IS NULL OR choice.quote_id IS NOT NULL OR choice.state='bound' OR choice.expires_at>clock_timestamp() OR private.retain_until>clock_timestamp() THEN RAISE EXCEPTION 'Shipping original input held' USING ERRCODE='23514'; END IF;
 SELECT * INTO p FROM treido.order_shipping_policies WHERE id=(choice.snapshot->'option'->'policy'->>'id')::uuid AND terms_hash=choice.snapshot->'option'->'policy'->>'termsHash' AND approved_at<=clock_timestamp() AND revoked_at IS NULL FOR SHARE;
 IF p.id IS NULL OR NOT treido.order_shipping_retention_ready(p.id,p.environment,p.application_id) THEN RAISE EXCEPTION 'Shipping reviewed retention unavailable' USING ERRCODE='55000'; END IF;
 IF p.environment IS DISTINCT FROM backend_env OR to_regclass('treido.order_shipping_retention_approvals') IS NULL THEN RAISE EXCEPTION 'Shipping current executor mapping missing' USING ERRCODE='55000'; END IF;
 EXECUTE 'SELECT EXISTS(SELECT 1 FROM treido.order_shipping_retention_approvals WHERE policy_id=$1 AND policy_hash=$2 AND platform_account=$3 AND livemode=$4 AND environment=$5 AND application_id=$6 AND executor_application_id=$7 AND executor_environment=$8 AND clerk_instance_id=$9 AND clerk_mode=$10 AND version=''order-shipping-retention-v1'' AND deletes_due_unbound AND deletes_due_accepted AND preserves_accepted_history AND requires_zero_obligations AND legal_holds_reviewed AND approved_at<=clock_timestamp() AND revoked_at IS NULL FOR SHARE)' INTO mapped USING p.id,p.terms_hash,p.platform_account,p.livemode,p.environment,p.application_id,executor_app,executor_env,clerk_app,clerk_mode_value;
 IF mapped IS DISTINCT FROM true THEN RAISE EXCEPTION 'Shipping current reviewed executor denied' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM treido.outbox_jobs o JOIN treido.job_effects e ON e.job_id=o.id WHERE o.id=j AND o.kind='shipping.input-expiry' AND o.authority='shipping' AND o.seller_id IS NULL AND o.buyer_id=u AND o.actor_id IS NULL AND o.resource_id=c AND o.operation_key=c AND o.generation=g AND o.state IN('pending','accepted') AND o.intent_hash=treido.order_shipping_input_intent_hash(u,c) AND e.kind=o.kind AND e.operation_key=o.operation_key AND e.state='running' AND e.execution_token=t AND e.execution_until>clock_timestamp()) THEN RAISE EXCEPTION 'Shipping actual original execution denied' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM treido.order_aftercare_legal_holds h WHERE h.user_id=u AND ((h.environment=p.environment AND h.application_id=p.application_id) OR (h.environment=backend_env AND h.application_id=clerk_app)) AND h.approved_at<=clock_timestamp() AND h.revoked_at IS NULL) THEN RAISE EXCEPTION 'Shipping legal evidence held' USING ERRCODE='55000'; END IF;
 IF private.value IS NULL THEN RETURN; END IF;
 UPDATE treido.order_shipping_recipients SET value=NULL,cleared_at=clock_timestamp() WHERE choice_id=c AND buyer_id=u;
END $$;
REVOKE ALL ON treido.order_shipping_policies,treido.order_shipping_carriers,treido.order_shipping_rates,treido.order_shipping_choices,treido.order_shipping_recipients,treido.order_shipping_receipts FROM PUBLIC;
REVOKE ALL ON FUNCTION treido.shipping_localized(jsonb),treido.guard_shipping_registry(),treido.check_shipping_policy_shape(),treido.guard_shipping_choice(),treido.guard_shipping_recipient(),treido.guard_shipping_receipt(),treido.order_shipping_input_intent_hash(uuid,uuid),treido.order_shipping_expire_input(uuid,uuid,uuid,integer,uuid,text,text,text,text,text) FROM PUBLIC;
