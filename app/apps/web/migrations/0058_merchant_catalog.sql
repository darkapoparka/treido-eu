-- Merchant organization is independent of buyer saved collections and accepted purchases.
-- Membership always carries seller_id so a product cannot cross seller boundaries.
CREATE TABLE treido.seller_catalog_state (
  seller_id uuid PRIMARY KEY REFERENCES treido.seller_accounts(id),
  revision integer NOT NULL DEFAULT 0 CHECK(revision >= 0)
);
CREATE TABLE treido.seller_catalog_collections (
  id uuid PRIMARY KEY,
  seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id),
  title varchar(120) NOT NULL CHECK(length(btrim(title)) > 0),
  description varchar(2000) NOT NULL DEFAULT '',
  visible boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 1 CHECK(revision > 0),
  created_by uuid NOT NULL REFERENCES treido.users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(seller_id,id),
  CHECK(NOT (archived AND visible))
);
CREATE INDEX seller_catalog_collections_browse
  ON treido.seller_catalog_collections(seller_id,archived,updated_at DESC,id DESC);
CREATE TABLE treido.seller_catalog_collection_items (
  seller_id uuid NOT NULL,
  collection_id uuid NOT NULL,
  listing_id uuid NOT NULL,
  added_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(seller_id,collection_id,listing_id),
  FOREIGN KEY(seller_id,collection_id) REFERENCES treido.seller_catalog_collections(seller_id,id),
  FOREIGN KEY(seller_id,listing_id) REFERENCES treido.listings(seller_id,id)
);
CREATE INDEX seller_catalog_items_product
  ON treido.seller_catalog_collection_items(seller_id,listing_id,collection_id);
CREATE TABLE treido.seller_catalog_product_organization (
  seller_id uuid NOT NULL,
  listing_id uuid NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  revision integer NOT NULL DEFAULT 1 CHECK(revision > 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(seller_id,listing_id),
  FOREIGN KEY(seller_id,listing_id) REFERENCES treido.listings(seller_id,id),
  CHECK(cardinality(tags) <= 20 AND array_position(tags,NULL) IS NULL)
);
CREATE INDEX seller_catalog_product_tags
  ON treido.seller_catalog_product_organization USING gin(tags);
CREATE TABLE treido.seller_catalog_command_receipts (
  seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id),
  actor_id uuid NOT NULL REFERENCES treido.users(id),
  request_id uuid NOT NULL,
  input_hash varchar(64) NOT NULL CHECK(input_hash ~ '^[0-9a-f]{64}$'),
  result jsonb NOT NULL CHECK(jsonb_typeof(result) = 'object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(seller_id,actor_id,request_id)
);
