-- T53 reviewed integration: buyer-owned saved searches and bounded in-app matching.
-- Apply only through the existing checksum development migration runner.
CREATE TABLE treido.buyer_saved_search_workspaces (
 user_id uuid PRIMARY KEY REFERENCES treido.users(id), revision integer NOT NULL DEFAULT 0 CHECK(revision>=0)
);
CREATE TABLE treido.buyer_saved_searches (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES treido.users(id), name varchar(80),
 status text NOT NULL CHECK(status IN ('paused','enabled','removed')),
 criteria_version integer NOT NULL CHECK(criteria_version>0), consent_generation integer NOT NULL DEFAULT 1 CHECK(consent_generation>0),
 frequency_minutes integer NOT NULL CHECK(frequency_minutes IN (60,1440)), consent_at timestamptz,
 due_at timestamptz, last_check_at timestamptz, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(user_id,id), CHECK((status='enabled')=(consent_at IS NOT NULL)),
 CHECK((status='removed' AND name IS NULL) OR (status<>'removed' AND name IS NOT NULL AND length(btrim(name)) BETWEEN 1 AND 80)),
 CHECK(status='enabled' OR due_at IS NULL)
);
CREATE INDEX buyer_search_due ON treido.buyer_saved_searches(due_at,id) WHERE status='enabled';
CREATE TABLE treido.buyer_saved_search_versions (
 user_id uuid NOT NULL, search_id uuid NOT NULL, version integer NOT NULL CHECK(version>0),
 criteria jsonb NOT NULL CHECK(jsonb_typeof(criteria)='object' AND octet_length(criteria::text)<=8000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(user_id,search_id,version),
 FOREIGN KEY(user_id,search_id) REFERENCES treido.buyer_saved_searches(user_id,id)
);
CREATE TABLE treido.buyer_saved_search_receipts (
 user_id uuid NOT NULL REFERENCES treido.users(id), request_id uuid NOT NULL,
 input_hash varchar(64) NOT NULL CHECK(input_hash ~ '^[a-f0-9]{64}$'), accepted_revision integer NOT NULL CHECK(accepted_revision>0),
 search_id uuid, criteria_version integer, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(user_id,request_id),
 FOREIGN KEY(user_id,search_id) REFERENCES treido.buyer_saved_searches(user_id,id)
);
CREATE INDEX buyer_search_receipt_rate ON treido.buyer_saved_search_receipts(user_id,created_at);
CREATE TABLE treido.buyer_saved_search_runs (
 id uuid PRIMARY KEY, user_id uuid NOT NULL, search_id uuid NOT NULL, criteria_version integer NOT NULL CHECK(criteria_version>0),
 consent_generation integer NOT NULL CHECK(consent_generation>0), state text NOT NULL DEFAULT 'running' CHECK(state IN ('running','bounded','finished','cancelled')),
 phase text NOT NULL DEFAULT 'catalogue' CHECK(phase IN ('catalogue','observed')), position jsonb, after_listing_id uuid,
 step integer NOT NULL DEFAULT 0 CHECK(step>=0 AND step<=100), catalogue_pages integer NOT NULL DEFAULT 0 CHECK(catalogue_pages BETWEEN 0 AND 10),
 checked integer NOT NULL DEFAULT 0 CHECK(checked>=0), observed integer NOT NULL DEFAULT 0 CHECK(observed>=0),
 ceiling timestamptz NOT NULL DEFAULT clock_timestamp(), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(user_id,id), FOREIGN KEY(user_id,search_id) REFERENCES treido.buyer_saved_searches(user_id,id),
 CHECK(position IS NULL OR (jsonb_typeof(position)='object' AND octet_length(position::text)<=1000))
);
CREATE UNIQUE INDEX buyer_search_one_run ON treido.buyer_saved_search_runs(search_id) WHERE state='running';
CREATE TABLE treido.buyer_search_observations (
 user_id uuid NOT NULL, search_id uuid NOT NULL, criteria_version integer NOT NULL CHECK(criteria_version>0), listing_id uuid NOT NULL REFERENCES treido.listings(id),
 publication_revision integer NOT NULL CHECK(publication_revision>0), sku_id uuid, price_minor integer NOT NULL CHECK(price_minor BETWEEN 0 AND 1000000000),
 stock_state text NOT NULL CHECK(stock_state IN ('unknown','available','reserved','out_of_stock')),
 eligible boolean NOT NULL DEFAULT true, change_number integer NOT NULL DEFAULT 1 CHECK(change_number>0),
 observed_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(user_id,search_id,criteria_version,listing_id),
 FOREIGN KEY(user_id,search_id) REFERENCES treido.buyer_saved_searches(user_id,id)
);
CREATE TABLE treido.buyer_search_notifications (
 id uuid PRIMARY KEY, user_id uuid NOT NULL, search_id uuid NOT NULL, criteria_version integer NOT NULL CHECK(criteria_version>0),
 consent_generation integer NOT NULL CHECK(consent_generation>0), listing_id uuid NOT NULL REFERENCES treido.listings(id),
 change_number integer NOT NULL CHECK(change_number>0), kind text NOT NULL CHECK(kind IN ('new_publication','price_changed','stock_changed','unavailable')),
 previous_fact jsonb, observed_fact jsonb, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(user_id,search_id,criteria_version,listing_id,change_number,kind), FOREIGN KEY(user_id,search_id) REFERENCES treido.buyer_saved_searches(user_id,id),
 CHECK(previous_fact IS NULL OR (jsonb_typeof(previous_fact)='object' AND octet_length(previous_fact::text)<=1000)),
 CHECK(observed_fact IS NULL OR (jsonb_typeof(observed_fact)='object' AND octet_length(observed_fact::text)<=1000))
);
CREATE INDEX buyer_search_feed ON treido.buyer_search_notifications(user_id,created_at DESC,id);
CREATE INDEX buyer_search_unread ON treido.buyer_search_notifications(user_id) WHERE read_at IS NULL;

-- Preserve every existing seller job/financial check. Add real buyer ownership.
ALTER TABLE treido.outbox_jobs ALTER COLUMN seller_id DROP NOT NULL;
ALTER TABLE treido.outbox_jobs ADD COLUMN buyer_id uuid REFERENCES treido.users(id);
ALTER TABLE treido.outbox_jobs DROP CONSTRAINT outbox_jobs_kind_check;
ALTER TABLE treido.outbox_jobs ADD CONSTRAINT outbox_jobs_kind_check CHECK(kind IN ('media.process','system.probe','catalogue.import','team.invitation','payment.reconcile','payment.refund','buyer.saved-search'));
ALTER TABLE treido.outbox_jobs DROP CONSTRAINT outbox_jobs_authority_check;
ALTER TABLE treido.outbox_jobs ADD CONSTRAINT outbox_jobs_authority_check CHECK(authority IN ('member','service','buyer'));
DO $$ DECLARE constraint_name text; matches integer;
BEGIN
 SELECT count(*),min(conname) INTO matches,constraint_name FROM pg_constraint
 WHERE conrelid='treido.outbox_jobs'::regclass AND contype='c'
 AND pg_get_constraintdef(oid) LIKE '%actor_id%' AND pg_get_constraintdef(oid) LIKE '%authority%' AND pg_get_constraintdef(oid) LIKE '%service%';
 IF matches<>1 THEN RAISE EXCEPTION 'Expected original outbox actor constraint'; END IF;
 EXECUTE format('ALTER TABLE treido.outbox_jobs DROP CONSTRAINT %I',constraint_name);
END $$;
ALTER TABLE treido.outbox_jobs ADD CONSTRAINT outbox_actor_authority CHECK((authority='member' AND actor_id IS NOT NULL) OR (authority='service' AND actor_id IS NULL) OR (authority='buyer' AND actor_id IS NOT NULL AND actor_id=buyer_id));
ALTER TABLE treido.outbox_jobs ADD CONSTRAINT outbox_owner_scope CHECK(
 (kind='buyer.saved-search' AND seller_id IS NULL AND buyer_id IS NOT NULL AND actor_id IS NOT NULL AND actor_id=buyer_id AND authority='buyer') OR
 (kind<>'buyer.saved-search' AND seller_id IS NOT NULL AND buyer_id IS NULL AND authority IN ('member','service')));
