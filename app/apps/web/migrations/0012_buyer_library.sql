-- Private human-owned library. Tombstones keep removals and retries durable.
CREATE TABLE treido.buyer_libraries (
  user_id uuid PRIMARY KEY REFERENCES treido.users(id),
  revision integer NOT NULL DEFAULT 0 CHECK(revision >= 0)
);
CREATE TABLE treido.saved_listings (
  user_id uuid NOT NULL REFERENCES treido.users(id),
  listing_id uuid NOT NULL REFERENCES treido.listings(id),
  saved boolean NOT NULL DEFAULT true,
  saved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id,listing_id)
);
CREATE INDEX saved_listing_page ON treido.saved_listings(user_id,saved_at DESC,listing_id DESC) WHERE saved;
CREATE TABLE treido.buyer_collections (
  user_id uuid NOT NULL REFERENCES treido.users(id),
  id uuid NOT NULL,
  name varchar(80) NOT NULL CHECK(char_length(btrim(name)) BETWEEN 1 AND 80),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id,id)
);
CREATE INDEX buyer_collection_page ON treido.buyer_collections(user_id,created_at DESC,id DESC) WHERE active;
CREATE TABLE treido.buyer_collection_items (
  user_id uuid NOT NULL,
  collection_id uuid NOT NULL,
  listing_id uuid NOT NULL,
  included boolean NOT NULL DEFAULT true,
  PRIMARY KEY(user_id,collection_id,listing_id),
  FOREIGN KEY(user_id,collection_id) REFERENCES treido.buyer_collections(user_id,id),
  FOREIGN KEY(user_id,listing_id) REFERENCES treido.saved_listings(user_id,listing_id)
);
CREATE INDEX buyer_collection_listing ON treido.buyer_collection_items(user_id,listing_id) WHERE included;
CREATE TABLE treido.seller_follows (
  user_id uuid NOT NULL REFERENCES treido.users(id),
  seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id),
  followed boolean NOT NULL DEFAULT true,
  followed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id,seller_id)
);
CREATE INDEX seller_follow_page ON treido.seller_follows(user_id,followed_at DESC,seller_id DESC) WHERE followed;
CREATE TABLE treido.buyer_library_receipts (
  user_id uuid NOT NULL REFERENCES treido.users(id),
  request_id uuid NOT NULL,
  input_hash varchar(64) NOT NULL CHECK(input_hash ~ '^[0-9a-f]{64}$'),
  accepted_revision integer NOT NULL CHECK(accepted_revision > 0),
  result_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id,request_id)
);
CREATE INDEX buyer_library_receipt_rate ON treido.buyer_library_receipts(user_id,created_at DESC);
