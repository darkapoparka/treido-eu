-- Immutable, private purchase reviews. These are NOT payable quotes or orders.
-- Contact publications have no approved payment/fee/shipping policy. No policy,
-- Connect account, inventory allocation or payment success is manufactured here.
CREATE TABLE treido.purchase_reviews (
  id uuid PRIMARY KEY,
  buyer_id uuid NOT NULL REFERENCES treido.users(id),
  seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id),
  request_id uuid NOT NULL,
  input_hash varchar(64) NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  source text NOT NULL CHECK (source IN ('cart','offer')),
  cart_revision integer,
  thread_id uuid REFERENCES treido.conversation_threads(id),
  offer_id uuid REFERENCES treido.listing_offers(id),
  allocation_id uuid,
  seller_name varchar(80) NOT NULL,
  currency text NOT NULL CHECK (currency='EUR'),
  merchandise_minor bigint NOT NULL CHECK (merchandise_minor BETWEEN 0 AND 2970000000000),
  language text NOT NULL CHECK (language IN ('bg','en')),
  handover text NOT NULL CHECK (handover IN ('pickup','shipping')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (buyer_id,request_id), UNIQUE (seller_id,id),
  FOREIGN KEY (seller_id,allocation_id) REFERENCES treido.inventory_allocations(seller_id,id),
  CHECK ((source='cart' AND cart_revision>0 AND thread_id IS NULL AND offer_id IS NULL AND allocation_id IS NULL)
      OR (source='offer' AND cart_revision IS NULL AND thread_id IS NOT NULL AND offer_id IS NOT NULL AND allocation_id IS NOT NULL)),
  CHECK (expires_at>created_at)
);
CREATE INDEX purchase_review_buyer ON treido.purchase_reviews(buyer_id,created_at DESC,id DESC);
CREATE TABLE treido.purchase_review_lines (
  review_id uuid NOT NULL, seller_id uuid NOT NULL, listing_id uuid NOT NULL,
  sku_id uuid NOT NULL, publication_revision integer NOT NULL,
  position integer NOT NULL CHECK (position BETWEEN 0 AND 29),
  title varchar(180) NOT NULL,
  options jsonb NOT NULL CHECK (jsonb_typeof(options)='object'),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  unit_price_minor integer NOT NULL CHECK (unit_price_minor BETWEEN 0 AND 1000000000),
  delivery_details varchar(1000) NOT NULL,
  PRIMARY KEY (review_id,sku_id), UNIQUE (review_id,position),
  FOREIGN KEY (seller_id,review_id) REFERENCES treido.purchase_reviews(seller_id,id),
  FOREIGN KEY (seller_id,listing_id,publication_revision,sku_id)
    REFERENCES treido.inventory_publication_skus(seller_id,listing_id,publication_revision,sku_id)
);
CREATE TABLE treido.purchase_review_preferences (
  review_id uuid PRIMARY KEY REFERENCES treido.purchase_reviews(id),
  revision integer NOT NULL DEFAULT 0 CHECK (revision>=0),
  note varchar(1000) NOT NULL DEFAULT '',
  archived boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE treido.purchase_review_receipts (
  review_id uuid NOT NULL REFERENCES treido.purchase_reviews(id),
  request_id uuid NOT NULL,
  input_hash varchar(64) NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  accepted_revision integer NOT NULL CHECK (accepted_revision>0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(review_id,request_id)
);
