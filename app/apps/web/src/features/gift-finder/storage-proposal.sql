-- T58/F21 original UNNUMBERED proposal. Shared owner reviews and assigns a free
-- canonical version; no registration, apply, seeds, policy or grants here.
CREATE TABLE treido.buyer_gift_workspaces (
  user_id uuid PRIMARY KEY REFERENCES treido.users(id),
  revision integer NOT NULL DEFAULT 0 CHECK(revision BETWEEN 0 AND 2147483646),
  brief jsonb,
  selected_ids uuid[] NOT NULL DEFAULT '{}',
  next_cursor text CHECK(next_cursor IS NULL OR octet_length(next_cursor)<=4096),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK(cardinality(selected_ids)<=4 AND array_position(selected_ids,NULL) IS NULL),
  CHECK(brief IS NULL OR (jsonb_typeof(brief)='object' AND brief->>'version'='1'
    AND brief->>'occasion' IN ('none','birthday','celebration','thanks','housewarming')
    AND brief->>'age' IN ('unspecified','child','teen','adult')
    AND brief ? 'neededBy' AND (brief->'neededBy'='null'::jsonb OR
      (jsonb_typeof(brief->'neededBy')='string' AND brief->>'neededBy' ~ '^\d{4}-\d{2}-\d{2}$'))
    AND jsonb_typeof(brief->'criteria')='string' AND octet_length(brief::text)<=12000) IS TRUE),
  CHECK(brief IS NOT NULL OR (cardinality(selected_ids)=0 AND next_cursor IS NULL))
);
CREATE TABLE treido.buyer_gift_observations (
  user_id uuid NOT NULL REFERENCES treido.buyer_gift_workspaces(user_id),
  position smallint NOT NULL CHECK(position BETWEEN 1 AND 20),
  seller_id uuid NOT NULL,
  listing_id uuid NOT NULL,
  publication_revision integer NOT NULL,
  sku_id uuid,
  snapshot jsonb NOT NULL CHECK((jsonb_typeof(snapshot)='object'
    AND snapshot->'observation'->>'listingId'=listing_id::text
    AND snapshot->'observation'->>'publicationRevision'=publication_revision::text
    AND octet_length(snapshot::text)<=16000) IS TRUE),
  observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id,position), UNIQUE(user_id,listing_id),
  FOREIGN KEY(seller_id,listing_id,publication_revision) REFERENCES treido.listing_publications(seller_id,listing_id,revision),
  FOREIGN KEY(seller_id,listing_id,publication_revision,sku_id) REFERENCES treido.inventory_publication_skus(seller_id,listing_id,publication_revision,sku_id)
);
CREATE TABLE treido.buyer_gift_receipts (
  user_id uuid NOT NULL REFERENCES treido.buyer_gift_workspaces(user_id),
  request_id uuid NOT NULL,
  input_hash varchar(64) NOT NULL CHECK(input_hash ~ '^[0-9a-f]{64}$'),
  accepted_revision integer NOT NULL CHECK(accepted_revision BETWEEN 1 AND 2147483646),
  operation text NOT NULL CHECK(operation IN ('find','page','choose','refresh','clear')),
  result_count smallint NOT NULL CHECK(result_count BETWEEN 0 AND 20),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id,request_id)
);
CREATE INDEX buyer_gift_receipt_rate ON treido.buyer_gift_receipts(user_id,created_at DESC);
