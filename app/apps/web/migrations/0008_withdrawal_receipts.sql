CREATE TABLE treido.listing_withdrawal_receipts (
  seller_id uuid NOT NULL,
  listing_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES treido.users(id),
  request_id uuid NOT NULL,
  input_hash varchar(64) NOT NULL CHECK(input_hash ~ '^[0-9a-f]{64}$'),
  accepted_revision integer NOT NULL CHECK(accepted_revision > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(seller_id,listing_id,actor_id,request_id),
  FOREIGN KEY(seller_id,listing_id) REFERENCES treido.listings(seller_id,id)
);
