-- T55/F25: reviewed human-owned bounded exports and non-destructive closure requests.
-- Snapshot required fields must satisfy the full predicate; no source account/evidence deletion.
CREATE TABLE treido.account_privacy_workspaces (
 user_id uuid PRIMARY KEY REFERENCES treido.users(id),
 revision integer NOT NULL DEFAULT 0 CHECK(revision>=0)
);
CREATE TABLE treido.account_privacy_exports (
 user_id uuid NOT NULL REFERENCES treido.account_privacy_workspaces(user_id), id uuid NOT NULL,
 categories jsonb NOT NULL CHECK(jsonb_typeof(categories)='array' AND jsonb_array_length(categories) BETWEEN 1 AND 7 AND categories <@ '["account","personalProfile","memberships","library","cart","searches","purchases"]'::jsonb),
 snapshot jsonb NOT NULL CHECK((jsonb_typeof(snapshot)='object' AND snapshot->>'format'='treido-personal-data-v1' AND snapshot->>'accountId'=user_id::text AND jsonb_typeof(snapshot->'sections')='array' AND jsonb_array_length(snapshot->'sections') BETWEEN 1 AND 7 AND octet_length(snapshot::text)<=262144) IS TRUE),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
 PRIMARY KEY(user_id,id), CHECK(expires_at>created_at AND expires_at<=created_at+interval '16 minutes')
);
CREATE INDEX account_privacy_export_page ON treido.account_privacy_exports(user_id,created_at DESC,id);
CREATE TABLE treido.account_privacy_reviews (
 user_id uuid NOT NULL REFERENCES treido.account_privacy_workspaces(user_id), id uuid NOT NULL,
 facts jsonb NOT NULL CHECK(jsonb_typeof(facts)='object' AND octet_length(facts::text)<=4096),
 facts_hash varchar(64) NOT NULL CHECK(facts_hash ~ '^[0-9a-f]{64}$'),
 policy_version text NOT NULL CHECK(policy_version='request-only-v1'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
 PRIMARY KEY(user_id,id), CHECK(expires_at>created_at AND expires_at<=created_at+interval '16 minutes')
);
CREATE INDEX account_privacy_review_page ON treido.account_privacy_reviews(user_id,created_at DESC,id);
CREATE TABLE treido.account_closure_requests (
 user_id uuid NOT NULL REFERENCES treido.account_privacy_workspaces(user_id), id uuid NOT NULL,
 review_id uuid NOT NULL, state text NOT NULL CHECK(state IN ('requested','withdrawn')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 acknowledged_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(user_id,id), FOREIGN KEY(user_id,review_id) REFERENCES treido.account_privacy_reviews(user_id,id),
 UNIQUE(user_id,review_id)
);
CREATE UNIQUE INDEX account_closure_one_pending ON treido.account_closure_requests(user_id) WHERE state='requested';
CREATE TABLE treido.account_privacy_receipts (
 user_id uuid NOT NULL REFERENCES treido.account_privacy_workspaces(user_id), request_id uuid NOT NULL,
 input_hash varchar(64) NOT NULL CHECK(input_hash ~ '^[0-9a-f]{64}$'),
 accepted_revision integer NOT NULL CHECK(accepted_revision>0),
 acknowledgment jsonb NOT NULL CHECK(jsonb_typeof(acknowledgment)='object' AND octet_length(acknowledgment::text)<=2048),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(user_id,request_id), UNIQUE(user_id,accepted_revision)
);
CREATE INDEX account_privacy_receipt_rate ON treido.account_privacy_receipts(user_id,created_at DESC);
