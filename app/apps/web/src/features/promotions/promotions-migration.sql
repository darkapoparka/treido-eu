-- UNNUMBERED T59 proposal. Canonical owner alone reviews, numbers and applies.
-- NO catalogue, capacity, approval, consent, supply or financial seed.
CREATE TABLE treido.promotion_products (
 id uuid PRIMARY KEY, product_id text NOT NULL CHECK(product_id IN ('bump_once_v1','category_spotlight_7d_v1','home_spotlight_7d_v1')),
 version integer NOT NULL CHECK(version>0), terms jsonb NOT NULL,
 platform_account text NOT NULL CHECK(platform_account ~ '^acct_[A-Za-z0-9]+$'),
 environment text NOT NULL CHECK(environment IN ('development','test','production')), application_id text NOT NULL,
 livemode boolean NOT NULL, approved_at timestamptz NOT NULL, revoked_at timestamptz,
 CHECK((jsonb_typeof(terms)='object' AND octet_length(terms::text)<=20000 AND terms->>'productId'=product_id AND (terms->>'version')::integer=version AND terms->>'currency'='EUR' AND (terms->>'totalMinor')::integer BETWEEN 1 AND 10000000 AND terms->>'tax'='inclusive' AND terms->'automaticRenewal'='false'::jsonb AND jsonb_typeof(terms->'text')='object' AND length(btrim(terms->>'approvalReference'))>0) IS TRUE),
 UNIQUE(product_id,version,platform_account,environment,application_id,livemode)
);
CREATE TABLE treido.promotion_capacity (
 id uuid PRIMARY KEY, product_policy_id uuid NOT NULL REFERENCES treido.promotion_products(id),
 country text NOT NULL CHECK(country='BG'), category_id text NOT NULL,
 seller_kind text NOT NULL CHECK(seller_kind IN ('personal','business')),
 slots integer NOT NULL CHECK(slots BETWEEN 1 AND 1000), waitlist_limit integer NOT NULL CHECK(waitlist_limit BETWEEN 0 AND 100),
 approved_at timestamptz NOT NULL, revoked_at timestamptz,
 UNIQUE(product_policy_id,country,category_id,seller_kind)
);
CREATE TABLE treido.promotion_campaigns (
 id uuid PRIMARY KEY, seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id), listing_id uuid NOT NULL,
 product_id text NOT NULL CHECK(product_id IN ('bump_once_v1','category_spotlight_7d_v1','home_spotlight_7d_v1')),
 revision integer NOT NULL CHECK(revision>0), state text NOT NULL CHECK(state IN ('draft','awaiting_payment','scheduled','active','paused','completed','cancelled','reconciling')),
 reason text CHECK(reason IN ('seller_choice','listing_unavailable','moderation','seller_restricted','platform_failure','provider_uncertain','expired','payment_failed','operator_safety')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(seller_id,listing_id) REFERENCES treido.listings(seller_id,id), UNIQUE(seller_id,id)
);
CREATE INDEX promotion_campaign_page ON treido.promotion_campaigns(seller_id,created_at DESC,id);
CREATE TABLE treido.promotion_reviews (
 id uuid PRIMARY KEY, seller_id uuid NOT NULL, campaign_id uuid NOT NULL, campaign_revision integer NOT NULL CHECK(campaign_revision>0),
 listing_revision integer NOT NULL CHECK(listing_revision>0), category_id text NOT NULL, country text NOT NULL CHECK(country='BG'),
 product_policy_id uuid REFERENCES treido.promotion_products(id), capacity_id uuid REFERENCES treido.promotion_capacity(id),
 terms jsonb, terms_hash varchar(64) NOT NULL CHECK(terms_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
 FOREIGN KEY(seller_id,campaign_id) REFERENCES treido.promotion_campaigns(seller_id,id), UNIQUE(seller_id,campaign_id,id),
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '16 minutes'),
 CHECK((terms IS NULL AND product_policy_id IS NULL AND capacity_id IS NULL) OR (terms IS NOT NULL AND product_policy_id IS NOT NULL AND capacity_id IS NOT NULL AND jsonb_typeof(terms)='object' AND octet_length(terms::text)<=20000))
);
CREATE INDEX promotion_latest_review ON treido.promotion_reviews(campaign_id,created_at DESC,id);
CREATE TABLE treido.promotion_attempts (
 id uuid PRIMARY KEY, seller_id uuid NOT NULL, campaign_id uuid NOT NULL UNIQUE, review_id uuid NOT NULL UNIQUE,
 intent jsonb NOT NULL CHECK(jsonb_typeof(intent)='object' AND octet_length(intent::text)<=4096),
 state text NOT NULL CHECK(state IN ('prepared','creating','reconciling','pending','paid','cancelled','quarantined')),
 provider_id text CHECK(provider_id ~ '^pi_[A-Za-z0-9]+$'), checkout_session_id text CHECK(checkout_session_id ~ '^cs_(test_|live_)?[A-Za-z0-9]+$'), checkout_url text CHECK(length(checkout_url)<=2048),
 platform_account text NOT NULL CHECK(platform_account ~ '^acct_[A-Za-z0-9]+$'), livemode boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(seller_id,campaign_id,review_id) REFERENCES treido.promotion_reviews(seller_id,campaign_id,id), UNIQUE(seller_id,campaign_id,id),
 CHECK((intent->>'purpose'='promotion' AND intent->>'attemptId'=id::text AND intent->>'sellerId'=seller_id::text AND intent->>'campaignId'=campaign_id::text AND intent->>'currency'='EUR' AND (intent->>'totalMinor')::integer BETWEEN 1 AND 10000000 AND intent->>'platformAccount'=platform_account AND intent->'livemode'=to_jsonb(livemode) AND intent->>'language' IN ('bg','en') AND intent->>'checkoutExpiresAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$' AND (intent->>'checkoutExpiresAt')::timestamptz>created_at AND (intent->>'checkoutExpiresAt')::timestamptz<=created_at+interval '45 minutes') IS TRUE)
);
CREATE UNIQUE INDEX promotion_provider_identity ON treido.promotion_attempts(platform_account,livemode,provider_id) WHERE provider_id IS NOT NULL;
CREATE UNIQUE INDEX promotion_checkout_identity ON treido.promotion_attempts(platform_account,livemode,checkout_session_id) WHERE checkout_session_id IS NOT NULL;
CREATE FUNCTION treido.promotion_keep_provider_identity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (OLD.provider_id IS NOT NULL AND NEW.provider_id IS DISTINCT FROM OLD.provider_id) OR (OLD.checkout_session_id IS NOT NULL AND NEW.checkout_session_id IS DISTINCT FROM OLD.checkout_session_id) THEN RAISE EXCEPTION 'Immutable promotion provider identity' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER promotion_provider_identity_immutable BEFORE UPDATE ON treido.promotion_attempts FOR EACH ROW EXECUTE FUNCTION treido.promotion_keep_provider_identity();
CREATE TABLE treido.promotion_purchases (
 campaign_id uuid PRIMARY KEY, seller_id uuid NOT NULL, attempt_id uuid NOT NULL UNIQUE, review_id uuid NOT NULL UNIQUE,
 terms jsonb NOT NULL CHECK(jsonb_typeof(terms)='object' AND octet_length(terms::text)<=20000),
 accepted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(seller_id,campaign_id,attempt_id) REFERENCES treido.promotion_attempts(seller_id,campaign_id,id),
 FOREIGN KEY(seller_id,campaign_id,review_id) REFERENCES treido.promotion_reviews(seller_id,campaign_id,id)
);
CREATE TABLE treido.promotion_intervals (
 campaign_id uuid PRIMARY KEY REFERENCES treido.promotion_purchases(campaign_id), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 CHECK(ends_at>=starts_at AND ends_at<=starts_at+interval '7 days')
);
CREATE TABLE treido.promotion_bump_signals (
 campaign_id uuid PRIMARY KEY REFERENCES treido.promotion_purchases(campaign_id),
 seller_id uuid NOT NULL, listing_id uuid NOT NULL, publication_revision integer NOT NULL CHECK(publication_revision>0),
 promoted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(seller_id,listing_id) REFERENCES treido.listings(seller_id,id)
);
CREATE INDEX promotion_bump_current_freshness ON treido.promotion_bump_signals(seller_id,listing_id,publication_revision,promoted_at DESC,campaign_id);
CREATE TABLE treido.promotion_reservations (
 campaign_id uuid PRIMARY KEY REFERENCES treido.promotion_campaigns(id), capacity_id uuid NOT NULL REFERENCES treido.promotion_capacity(id),
 status text NOT NULL CHECK(status IN ('reserved','waitlisted','serving','released')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL
);
CREATE INDEX promotion_capacity_queue ON treido.promotion_reservations(capacity_id,status,created_at,campaign_id);
CREATE TABLE treido.promotion_events (
 id uuid PRIMARY KEY, campaign_id uuid NOT NULL REFERENCES treido.promotion_campaigns(id), actor_id uuid REFERENCES treido.users(id),
 source text NOT NULL CHECK(source IN ('seller','service','operator')), action text NOT NULL CHECK(action IN ('save','review','waitlist','purchase','pause','cancel','recheck','provider','expire','start','bump')),
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 300), state text NOT NULL, revision integer NOT NULL CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(campaign_id,revision)
);
CREATE TABLE treido.promotion_receipts (
 actor_id uuid NOT NULL REFERENCES treido.users(id), seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id), request_id uuid NOT NULL,
 input_hash varchar(64) NOT NULL CHECK(input_hash ~ '^[0-9a-f]{64}$'),
 acknowledgment jsonb NOT NULL CHECK(jsonb_typeof(acknowledgment)='object' AND octet_length(acknowledgment::text)<=2048),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(actor_id,seller_id,request_id)
);
CREATE INDEX promotion_command_rate ON treido.promotion_receipts(actor_id,seller_id,created_at DESC);
CREATE TABLE treido.promotion_provider_events (
 platform_account text NOT NULL, livemode boolean NOT NULL, event_id text NOT NULL CHECK(event_id ~ '^evt_[A-Za-z0-9]+$'),
 attempt_id uuid NOT NULL REFERENCES treido.promotion_attempts(id), evidence_hash varchar(64) NOT NULL CHECK(evidence_hash ~ '^[0-9a-f]{64}$'),
 authoritative_at timestamptz NOT NULL, state text NOT NULL CHECK(state IN ('paid','pending','cancelled','failed','refunded','disputed')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(platform_account,livemode,event_id)
);
CREATE TABLE treido.promotion_provider_signals (
 platform_account text NOT NULL, livemode boolean NOT NULL, event_id text NOT NULL CHECK(event_id ~ '^evt_[A-Za-z0-9]+$'),
 attempt_id uuid NOT NULL REFERENCES treido.promotion_attempts(id), provider_id text NOT NULL CHECK(provider_id ~ '^(pi_|cs_(test_|live_)?)[A-Za-z0-9]+$'),
 provider_created_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(platform_account,livemode,event_id)
);
CREATE INDEX promotion_provider_signal_attempt ON treido.promotion_provider_signals(attempt_id,provider_created_at DESC,event_id DESC);
CREATE TABLE treido.promotion_metrics (
 campaign_id uuid NOT NULL REFERENCES treido.promotion_campaigns(id), placement_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('impression','click','inquiry')), policy_version text NOT NULL CHECK(policy_version='visible-v1'),
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
 PRIMARY KEY(campaign_id,placement_id,kind), CHECK(expires_at>occurred_at AND expires_at<=occurred_at+interval '90 days')
);
CREATE INDEX promotion_metrics_aggregate ON treido.promotion_metrics(campaign_id,kind,occurred_at);
CREATE FUNCTION treido.promotion_keep_live_metric() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$ BEGIN
 IF OLD.expires_at>clock_timestamp() THEN RAISE EXCEPTION 'Only expired promotion metrics may be deleted' USING ERRCODE='23514'; END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER promotion_live_metric_guard BEFORE DELETE ON treido.promotion_metrics FOR EACH ROW EXECUTE FUNCTION treido.promotion_keep_live_metric();
CREATE TABLE treido.promotion_remedy_reviews (
 campaign_id uuid PRIMARY KEY REFERENCES treido.promotion_purchases(campaign_id),
 kind text NOT NULL CHECK(kind IN ('full_refund_review','prorated_review')), maximum_minor integer NOT NULL CHECK(maximum_minor BETWEEN 0 AND 10000000),
 reason text NOT NULL CHECK(reason='platform_failure'), created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE treido.promotion_measurement_policies (
 id uuid PRIMARY KEY, version integer NOT NULL CHECK(version>0), policy_version text NOT NULL CHECK(policy_version='visible-v1'),
 environment text NOT NULL CHECK(environment IN ('development','test','production')), application_id text NOT NULL,
 retention_days integer NOT NULL CHECK(retention_days BETWEEN 1 AND 90), consent_rule text NOT NULL CHECK(consent_rule='explicit_promotion_measurement_opt_in'),
 event_definition jsonb NOT NULL CHECK(event_definition='{"ratio":0.5,"continuousMilliseconds":1000,"foreground":true,"click":"product_anchor"}'::jsonb),
 text jsonb NOT NULL CHECK((jsonb_typeof(text)='object' AND octet_length(text::text)<=16000 AND length(btrim(text->>'bg'))>0 AND length(btrim(text->>'en'))>0) IS TRUE),
 approval_reference text NOT NULL CHECK(length(btrim(approval_reference)) BETWEEN 1 AND 200),
 approved_at timestamptz NOT NULL, revoked_at timestamptz,
 UNIQUE(environment,application_id,version)
);
CREATE TABLE treido.promotion_measurement_choices (
 user_id uuid NOT NULL REFERENCES treido.users(id), policy_id uuid NOT NULL REFERENCES treido.promotion_measurement_policies(id),
 request_id uuid NOT NULL, allowed boolean NOT NULL, revision integer NOT NULL CHECK(revision>0), input_hash varchar(64) NOT NULL CHECK(input_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(user_id,request_id), UNIQUE(user_id,policy_id,revision)
);
CREATE INDEX promotion_measurement_current_choice ON treido.promotion_measurement_choices(user_id,policy_id,created_at DESC,request_id DESC);
-- Policies/capacity are approved through the operator/configuration owner's normal path, never runtime writes.
CREATE FUNCTION treido.promotion_registry_version() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$ BEGIN
 IF to_jsonb(NEW)-'revoked_at' IS DISTINCT FROM to_jsonb(OLD)-'revoked_at'
 OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at)
 THEN RAISE EXCEPTION 'Immutable approved promotion registry version' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER promotion_product_version_guard BEFORE UPDATE ON treido.promotion_products FOR EACH ROW EXECUTE FUNCTION treido.promotion_registry_version();
CREATE TRIGGER promotion_capacity_version_guard BEFORE UPDATE ON treido.promotion_capacity FOR EACH ROW EXECUTE FUNCTION treido.promotion_registry_version();
CREATE TRIGGER promotion_measurement_version_guard BEFORE UPDATE ON treido.promotion_measurement_policies FOR EACH ROW EXECUTE FUNCTION treido.promotion_registry_version();
REVOKE ALL ON FUNCTION treido.promotion_registry_version(),treido.promotion_keep_provider_identity(),treido.promotion_keep_live_metric() FROM PUBLIC;
