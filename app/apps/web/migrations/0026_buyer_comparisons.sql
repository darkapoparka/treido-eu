-- T52 buyer-comparison storage, registered by the shared integrator.
-- No users, approvals, inventory, payments or outcomes are seeded.
CREATE TABLE treido.buyer_comparison_workspaces (
  user_id uuid PRIMARY KEY REFERENCES treido.users(id),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0)
);
CREATE TABLE treido.buyer_comparison_selections (
  user_id uuid NOT NULL REFERENCES treido.buyer_comparison_workspaces(user_id),
  id uuid NOT NULL,
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 4),
  seller_id uuid NOT NULL,
  listing_id uuid NOT NULL,
  publication_revision integer NOT NULL,
  sku_id uuid,
  price_minor integer NOT NULL CHECK (price_minor BETWEEN 0 AND 1000000000),
  currency text NOT NULL DEFAULT 'EUR' CHECK (currency='EUR'),
  stock_state text NOT NULL CHECK (stock_state IN ('unknown','available','reserved','out_of_stock')),
  observed_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (user_id,id),
  UNIQUE (user_id,listing_id),
  CONSTRAINT buyer_comparison_position UNIQUE (user_id,position) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (seller_id,listing_id,publication_revision)
    REFERENCES treido.listing_publications(seller_id,listing_id,revision),
  FOREIGN KEY (seller_id,listing_id,publication_revision,sku_id)
    REFERENCES treido.inventory_publication_skus(seller_id,listing_id,publication_revision,sku_id)
);
-- Four constrained positions are the database-enforced retained selection bound.
-- Refresh replaces an observation through explicit DELETE + INSERT, never by
-- making an immutable observed price look like a current quote or stock claim.
CREATE TABLE treido.buyer_comparison_receipts (
  user_id uuid NOT NULL REFERENCES treido.buyer_comparison_workspaces(user_id),
  request_id uuid NOT NULL,
  input_hash varchar(64) NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  accepted_revision integer NOT NULL CHECK (accepted_revision > 0),
  operation text NOT NULL CHECK (operation IN ('add','remove','reorder','clear','refresh')),
  selection_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id,request_id)
);
CREATE INDEX buyer_comparison_receipt_rate ON treido.buyer_comparison_receipts(user_id,created_at DESC);
