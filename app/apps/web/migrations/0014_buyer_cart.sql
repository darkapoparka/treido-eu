CREATE TABLE treido.buyer_carts (
  user_id uuid PRIMARY KEY REFERENCES treido.users(id),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0)
);
CREATE TABLE treido.buyer_cart_lines (
  user_id uuid NOT NULL REFERENCES treido.buyer_carts(user_id),
  seller_id uuid NOT NULL, listing_id uuid NOT NULL, sku_id uuid NOT NULL,
  publication_revision integer NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  seen_price_minor integer NOT NULL CHECK (seen_price_minor BETWEEN 0 AND 1000000000),
  active boolean NOT NULL DEFAULT true,
  added_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id,sku_id),
  FOREIGN KEY (seller_id,listing_id,publication_revision,sku_id) REFERENCES treido.inventory_publication_skus(seller_id,listing_id,publication_revision,sku_id)
);
CREATE INDEX buyer_cart_active ON treido.buyer_cart_lines(user_id,added_at DESC,sku_id) WHERE active;
CREATE TABLE treido.buyer_cart_receipts (
  user_id uuid NOT NULL REFERENCES treido.buyer_carts(user_id),
  request_id uuid NOT NULL,
  input_hash varchar(64) NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  accepted_revision integer NOT NULL CHECK (accepted_revision > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id,request_id)
);
-- A cart is a durable shopping list, not a stock hold or payment attempt.
