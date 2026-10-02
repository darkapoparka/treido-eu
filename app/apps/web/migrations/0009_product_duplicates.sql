-- A duplicate is a fresh draft; an actor's retry key cannot copy a second source.
CREATE TABLE treido.listing_duplicate_receipts (
  seller_id uuid NOT NULL,
  source_listing_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES treido.users(id),
  request_id uuid NOT NULL,
  input_hash varchar(64) NOT NULL CHECK(input_hash ~ '^[0-9a-f]{64}$'),
  new_listing_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(seller_id,actor_id,request_id),
  UNIQUE(seller_id,new_listing_id),
  CHECK(source_listing_id <> new_listing_id),
  FOREIGN KEY(seller_id,source_listing_id) REFERENCES treido.listings(seller_id,id),
  FOREIGN KEY(seller_id,new_listing_id) REFERENCES treido.listings(seller_id,id)
);
