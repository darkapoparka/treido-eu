-- T54/F22 UNNUMBERED REVIEW PROPOSAL. No runner registration/application.
-- Shared storage owner assigns the actual free number after original-path review.
-- No humans, sellers, supply, consent, policies, permissions or effects are seeded.
CREATE TABLE treido.buyer_compatibility_workspaces (
  user_id uuid PRIMARY KEY REFERENCES treido.users(id),
  revision integer NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 2147483646),
  requirements jsonb,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (requirements IS NULL OR (jsonb_typeof(requirements)='object' AND octet_length(requirements::text)<=16000))
);
CREATE TABLE treido.buyer_compatibility_observations (
  user_id uuid NOT NULL REFERENCES treido.buyer_compatibility_workspaces(user_id),
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 4),
  seller_id uuid NOT NULL,
  listing_id uuid NOT NULL,
  publication_revision integer NOT NULL,
  sku_id uuid,
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot)='object' AND octet_length(snapshot::text)<=16000),
  observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id,position),
  UNIQUE (user_id,listing_id),
  FOREIGN KEY (seller_id,listing_id,publication_revision) REFERENCES treido.listing_publications(seller_id,listing_id,revision),
  FOREIGN KEY (seller_id,listing_id,publication_revision,sku_id) REFERENCES treido.inventory_publication_skus(seller_id,listing_id,publication_revision,sku_id)
);
CREATE TABLE treido.buyer_compatibility_receipts (
  user_id uuid NOT NULL REFERENCES treido.buyer_compatibility_workspaces(user_id),
  request_id uuid NOT NULL,
  input_hash varchar(64) NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  accepted_revision integer NOT NULL CHECK (accepted_revision>0),
  operation text NOT NULL CHECK (operation IN ('check','refresh','clear')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id,request_id)
);
CREATE INDEX buyer_compatibility_receipt_rate ON treido.buyer_compatibility_receipts(user_id,created_at DESC);
CREATE TABLE treido.seller_helper_workspaces (
  user_id uuid NOT NULL REFERENCES treido.users(id),
  seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id),
  revision integer NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 2147483646),
  PRIMARY KEY(user_id,seller_id)
);
CREATE TABLE treido.seller_helper_proposals (
  user_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  id uuid NOT NULL,
  slot smallint NOT NULL CHECK (slot BETWEEN 1 AND 5),
  listing_id uuid NOT NULL,
  draft_revision integer NOT NULL CHECK (draft_revision>0),
  base_hash varchar(64) NOT NULL CHECK (base_hash ~ '^[0-9a-f]{64}$'),
  proposal_hash varchar(64) NOT NULL CHECK (proposal_hash ~ '^[0-9a-f]{64}$'),
  original_edit jsonb NOT NULL CHECK (jsonb_typeof(original_edit)='object' AND octet_length(original_edit::text)<=48000),
  proposed_payload jsonb NOT NULL CHECK (jsonb_typeof(proposed_payload)='object' AND octet_length(proposed_payload::text)<=48000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id,seller_id,id),
  UNIQUE(user_id,seller_id,slot),
  UNIQUE(user_id,seller_id,listing_id),
  FOREIGN KEY(user_id,seller_id) REFERENCES treido.seller_helper_workspaces(user_id,seller_id),
  FOREIGN KEY(seller_id,listing_id) REFERENCES treido.listings(seller_id,id)
);
CREATE TABLE treido.seller_helper_acceptance_intents (
  user_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  request_id uuid NOT NULL,
  input_hash varchar(64) NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  accepted_revision integer NOT NULL CHECK (accepted_revision>0),
  proposal_id uuid NOT NULL,
  listing_id uuid NOT NULL,
  draft_revision integer NOT NULL CHECK (draft_revision>0),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object' AND octet_length(payload::text)<=48000),
  original_command jsonb NOT NULL CHECK (jsonb_typeof(original_command)='object' AND octet_length(original_command::text)<=4096),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id,seller_id,request_id),
  UNIQUE(user_id,seller_id),
  FOREIGN KEY(user_id,seller_id) REFERENCES treido.seller_helper_workspaces(user_id,seller_id),
  FOREIGN KEY(seller_id,listing_id) REFERENCES treido.listings(seller_id,id)
);
CREATE TABLE treido.seller_helper_receipts (
  user_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  request_id uuid NOT NULL,
  input_hash varchar(64) NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  accepted_revision integer NOT NULL CHECK (accepted_revision>0),
  operation text NOT NULL CHECK (operation IN ('prepare','accept','discard')),
  result jsonb NOT NULL CHECK (jsonb_typeof(result)='object' AND octet_length(result::text)<=4096),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id,seller_id,request_id),
  FOREIGN KEY(user_id,seller_id) REFERENCES treido.seller_helper_workspaces(user_id,seller_id)
);
CREATE INDEX seller_helper_receipt_rate ON treido.seller_helper_receipts(user_id,created_at DESC);
-- Active requirements/results are purged by explicit clear; private proposals by
-- discard/replacement/apply. Acceptance payloads are deleted only after a durable
-- terminal acknowledgement. Minimal hashes/receipt metadata remain for exact
-- retry safety. No invented statutory retention or deletion of accepted drafts.
