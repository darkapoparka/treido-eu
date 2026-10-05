-- No policy approvals, seller mappings, credentials or provider objects are seeded.
-- Approval registries are readable by runtime; only the reviewed migration role writes them.
CREATE TABLE treido.payment_policies (
  id uuid PRIMARY KEY, platform_account varchar(100) NOT NULL CHECK(platform_account ~ '^acct_[A-Za-z0-9]+$'),
  livemode boolean NOT NULL, environment varchar(64) NOT NULL, application_id varchar(80) NOT NULL,
  currency text NOT NULL CHECK(currency='EUR'), fee_bps integer NOT NULL CHECK(fee_bps BETWEEN 0 AND 10000),
  fee_fixed_minor integer NOT NULL CHECK(fee_fixed_minor BETWEEN 0 AND 1000000),
  tax_policy text NOT NULL CHECK(tax_policy='inclusive'), handover text NOT NULL CHECK(handover='pickup'),
  settlement_merchant text NOT NULL CHECK(settlement_merchant IN ('platform','seller')),
  refund_policy text NOT NULL CHECK(refund_policy='full_fee_and_transfer_reversal'),
  buyer_terms jsonb NOT NULL CHECK(jsonb_typeof(buyer_terms)='object' AND buyer_terms->>'bg' IS NOT NULL AND buyer_terms->>'en' IS NOT NULL AND length(buyer_terms->>'bg') BETWEEN 1 AND 5000 AND length(buyer_terms->>'en') BETWEEN 1 AND 5000),
  approval_reference varchar(1000) NOT NULL CHECK(length(approval_reference)>0),
  approved_at timestamptz NOT NULL, revoked_at timestamptz,
  UNIQUE(id,platform_account,livemode)
);
CREATE TABLE treido.seller_payment_bindings (
  id uuid PRIMARY KEY, seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id),
  platform_account varchar(100) NOT NULL CHECK(platform_account ~ '^acct_[A-Za-z0-9]+$'), livemode boolean NOT NULL,
  connected_account varchar(100) NOT NULL CHECK(connected_account ~ '^acct_[A-Za-z0-9]+$' AND connected_account<>platform_account),
  approval_reference varchar(1000) NOT NULL CHECK(length(approval_reference)>0), approved_at timestamptz NOT NULL, revoked_at timestamptz,
  UNIQUE(seller_id,platform_account,livemode), UNIQUE(platform_account,livemode,connected_account), UNIQUE(id,seller_id)
);
CREATE TABLE treido.payable_listing_terms (
  seller_id uuid NOT NULL, listing_id uuid NOT NULL, publication_revision integer NOT NULL,
  policy_id uuid NOT NULL REFERENCES treido.payment_policies(id),
  approval_reference varchar(1000) NOT NULL CHECK(length(approval_reference)>0), approved_at timestamptz NOT NULL, revoked_at timestamptz,
  PRIMARY KEY(seller_id,listing_id,publication_revision,policy_id),
  FOREIGN KEY(seller_id,listing_id,publication_revision) REFERENCES treido.listing_publications(seller_id,listing_id,revision)
);
CREATE TABLE treido.payable_quotes (
  id uuid PRIMARY KEY, buyer_id uuid NOT NULL REFERENCES treido.users(id), seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id),
  request_id uuid NOT NULL, input_hash varchar(64) NOT NULL CHECK(input_hash ~ '^[0-9a-f]{64}$'),
  allocation_id uuid NOT NULL UNIQUE, policy_id uuid NOT NULL REFERENCES treido.payment_policies(id), binding_id uuid NOT NULL,
  platform_account varchar(100) NOT NULL, livemode boolean NOT NULL, connected_account varchar(100) NOT NULL,
  currency text NOT NULL CHECK(currency='EUR'), total_minor integer NOT NULL CHECK(total_minor BETWEEN 50 AND 99999999),
  application_fee_minor integer NOT NULL CHECK(application_fee_minor>=0 AND application_fee_minor<=total_minor),
  buyer_fee_minor integer NOT NULL DEFAULT 0 CHECK(buyer_fee_minor=0), delivery_minor integer NOT NULL DEFAULT 0 CHECK(delivery_minor=0),
  terms_snapshot jsonb NOT NULL CHECK(jsonb_typeof(terms_snapshot)='object'), seller_name varchar(80) NOT NULL,
  language text NOT NULL CHECK(language IN ('bg','en')), source jsonb NOT NULL CHECK(jsonb_typeof(source)='object'),
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(buyer_id,request_id), UNIQUE(seller_id,id),
  FOREIGN KEY(seller_id,allocation_id) REFERENCES treido.inventory_allocations(seller_id,id),
  FOREIGN KEY(binding_id,seller_id) REFERENCES treido.seller_payment_bindings(id,seller_id),
  FOREIGN KEY(policy_id,platform_account,livemode) REFERENCES treido.payment_policies(id,platform_account,livemode),
  CHECK(expires_at>created_at)
);
CREATE TABLE treido.payable_quote_lines (
  quote_id uuid NOT NULL, seller_id uuid NOT NULL, listing_id uuid NOT NULL, sku_id uuid NOT NULL,
  publication_revision integer NOT NULL, position integer NOT NULL CHECK(position BETWEEN 0 AND 29),
  title varchar(180) NOT NULL, options jsonb NOT NULL CHECK(jsonb_typeof(options)='object'),
  quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 99), unit_price_minor integer NOT NULL CHECK(unit_price_minor BETWEEN 0 AND 1000000000),
  delivery_details varchar(1000) NOT NULL, PRIMARY KEY(quote_id,sku_id), UNIQUE(quote_id,position),
  FOREIGN KEY(seller_id,quote_id) REFERENCES treido.payable_quotes(seller_id,id),
  FOREIGN KEY(seller_id,listing_id,publication_revision,sku_id) REFERENCES treido.inventory_publication_skus(seller_id,listing_id,publication_revision,sku_id)
);
CREATE FUNCTION treido.check_payable_quote() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE q treido.payable_quotes; a treido.inventory_allocations; b treido.seller_payment_bindings; p treido.payment_policies; n integer; amount bigint; quote_key uuid;
BEGIN
  IF TG_TABLE_NAME='payable_quotes' THEN quote_key:=NEW.id; ELSE quote_key:=NEW.quote_id; END IF;
  SELECT * INTO q FROM treido.payable_quotes WHERE id=quote_key;
  SELECT * INTO a FROM treido.inventory_allocations WHERE id=q.allocation_id;
  SELECT * INTO b FROM treido.seller_payment_bindings WHERE id=q.binding_id;
  SELECT * INTO p FROM treido.payment_policies WHERE id=q.policy_id;
  SELECT count(*),sum(quantity::bigint*unit_price_minor) INTO n,amount FROM treido.payable_quote_lines WHERE quote_id=q.id;
  IF a.buyer_id<>q.buyer_id OR a.seller_id<>q.seller_id OR a.expires_at<>q.expires_at OR n NOT BETWEEN 1 AND 30 OR amount<>q.total_minor
    OR b.platform_account<>q.platform_account OR b.livemode<>q.livemode OR b.connected_account<>q.connected_account
    OR q.application_fee_minor<>((q.total_minor::bigint*p.fee_bps+5000)/10000+p.fee_fixed_minor)
    OR q.terms_snapshot->>'settlementMerchant' IS DISTINCT FROM p.settlement_merchant
    OR q.terms_snapshot->>'buyerTerms' IS DISTINCT FROM p.buyer_terms->>q.language
    OR EXISTS(SELECT 1 FROM (SELECT * FROM treido.payable_quote_lines WHERE quote_id=q.id) l FULL JOIN (SELECT * FROM treido.inventory_allocation_lines WHERE allocation_id=q.allocation_id) al ON al.sku_id=l.sku_id
      WHERE (l.quote_id IS DISTINCT FROM q.id OR al.allocation_id IS DISTINCT FROM q.allocation_id
       OR l.seller_id IS DISTINCT FROM al.seller_id OR l.listing_id IS DISTINCT FROM al.listing_id OR l.quantity IS DISTINCT FROM al.quantity OR l.unit_price_minor IS DISTINCT FROM al.unit_price_minor OR l.publication_revision IS DISTINCT FROM al.publication_revision OR al.currency<>'EUR'))
  THEN RAISE EXCEPTION 'Immutable quote/allocation mismatch'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER payable_quote_check AFTER INSERT ON treido.payable_quotes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION treido.check_payable_quote();
CREATE CONSTRAINT TRIGGER payable_quote_line_check AFTER INSERT ON treido.payable_quote_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION treido.check_payable_quote();
CREATE TABLE treido.payment_attempts (
  id uuid PRIMARY KEY, quote_id uuid NOT NULL UNIQUE REFERENCES treido.payable_quotes(id), seller_id uuid NOT NULL,
  platform_account varchar(100) NOT NULL, livemode boolean NOT NULL,
  operation_key varchar(160) NOT NULL UNIQUE, api_version varchar(100) NOT NULL,
  parameters jsonb NOT NULL CHECK(jsonb_typeof(parameters)='object'), parameter_hash varchar(64) NOT NULL CHECK(parameter_hash ~ '^[0-9a-f]{64}$'),
  state text NOT NULL DEFAULT 'prepared' CHECK(state IN ('prepared','creating','reconciling','requires_payment_method','requires_action','processing','paid','cancelling','cancelled','quarantined')),
  provider_id varchar(100), cancel_requested boolean NOT NULL DEFAULT false, cancel_key varchar(160) NOT NULL UNIQUE,
  first_attempt_at timestamptz, observed_at timestamptz, reconcile_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(platform_account,livemode,provider_id), FOREIGN KEY(seller_id,quote_id) REFERENCES treido.payable_quotes(seller_id,id)
);
CREATE INDEX payment_repair_due ON treido.payment_attempts(reconcile_at,id) WHERE state NOT IN ('cancelled');
CREATE TABLE treido.stripe_webhook_receipts (
  platform_account varchar(100) NOT NULL, livemode boolean NOT NULL, event_id varchar(100) NOT NULL,
  event_type varchar(100) NOT NULL, body_hash varchar(64) NOT NULL CHECK(body_hash ~ '^[0-9a-f]{64}$'),
  provider_created bigint NOT NULL, object_id varchar(100), received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(platform_account,livemode,event_id)
);
CREATE TABLE treido.payment_facts (
  attempt_id uuid NOT NULL REFERENCES treido.payment_attempts(id), platform_account varchar(100) NOT NULL, livemode boolean NOT NULL,
  kind text NOT NULL CHECK(kind IN ('charge','transfer','application_fee','provider_fee','refund','transfer_reversal','fee_refund','dispute')),
  object_id varchar(100) NOT NULL, currency varchar(3) NOT NULL, amount_minor bigint NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(platform_account,livemode,kind,object_id)
);
CREATE TABLE treido.paid_orders (
  id uuid PRIMARY KEY, quote_id uuid NOT NULL UNIQUE REFERENCES treido.payable_quotes(id), attempt_id uuid NOT NULL UNIQUE REFERENCES treido.payment_attempts(id),
  seller_id uuid NOT NULL, buyer_id uuid NOT NULL REFERENCES treido.users(id),
  payment_state text NOT NULL CHECK(payment_state IN ('paid','refund_pending','refunded','disputed','reconciliation')),
  fulfilment_state text NOT NULL DEFAULT 'pending' CHECK(fulfilment_state IN ('pending','ready','collected','blocked')),
  settlement_state text NOT NULL CHECK(settlement_state IN ('transferred','reconciliation','reversed')),
  revision integer NOT NULL DEFAULT 0 CHECK(revision>=0), created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(seller_id,quote_id) REFERENCES treido.payable_quotes(seller_id,id)
);
CREATE INDEX paid_order_buyer ON treido.paid_orders(buyer_id,created_at DESC,id);
CREATE INDEX paid_order_seller ON treido.paid_orders(seller_id,created_at DESC,id);
CREATE TABLE treido.paid_order_receipts (
  order_id uuid NOT NULL REFERENCES treido.paid_orders(id), request_id uuid NOT NULL, actor_id uuid NOT NULL REFERENCES treido.users(id),
  command text NOT NULL CHECK(command IN ('ready','collected','refund')), input_hash varchar(64) NOT NULL,
  accepted_revision integer NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(order_id,request_id)
);
CREATE TABLE treido.payment_refunds (
  id uuid PRIMARY KEY, order_id uuid NOT NULL UNIQUE REFERENCES treido.paid_orders(id), attempt_id uuid NOT NULL REFERENCES treido.payment_attempts(id),
  seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id), actor_id uuid NOT NULL REFERENCES treido.users(id), reason varchar(500) NOT NULL CHECK(length(reason)>0),
  recent_auth_verified_at timestamptz NOT NULL, operation_key varchar(160) NOT NULL UNIQUE,
  parameters jsonb NOT NULL CHECK(jsonb_typeof(parameters)='object'), parameter_hash varchar(64) NOT NULL,
  state text NOT NULL DEFAULT 'prepared' CHECK(state IN ('prepared','creating','reconciling','pending','succeeded','failed')),
  provider_id varchar(100) UNIQUE, first_attempt_at timestamptz, reconcile_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE treido.connect_onboarding_intents (
  id uuid PRIMARY KEY, seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id), actor_id uuid NOT NULL REFERENCES treido.users(id),
  request_id uuid NOT NULL, input_hash varchar(64) NOT NULL, binding_id uuid NOT NULL REFERENCES treido.seller_payment_bindings(id),
  operation_key varchar(160) NOT NULL UNIQUE, parameters jsonb NOT NULL,
  state text NOT NULL DEFAULT 'prepared' CHECK(state IN ('prepared','creating','issued','reconciling')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(seller_id,actor_id,request_id)
);
ALTER TABLE treido.outbox_jobs DROP CONSTRAINT outbox_jobs_kind_check;
ALTER TABLE treido.outbox_jobs ADD CONSTRAINT outbox_jobs_kind_check CHECK(kind IN ('media.process','system.probe','catalogue.import','team.invitation','payment.reconcile','payment.refund'));
ALTER TABLE treido.outbox_jobs ADD CONSTRAINT payment_job_service CHECK(kind NOT IN ('payment.reconcile','payment.refund') OR authority='service');
