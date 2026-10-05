-- Stock is opt-in. Do not invent quantities for existing contact-only listings.
CREATE TABLE treido.inventory_catalogues (
  seller_id uuid NOT NULL,
  listing_id uuid PRIMARY KEY,
  seller_kind text NOT NULL CHECK (seller_kind IN ('personal','business')),
  mode text NOT NULL CHECK (mode IN ('unique','stocked')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (seller_id,listing_id), UNIQUE (seller_id,listing_id,mode),
  FOREIGN KEY (seller_id,listing_id) REFERENCES treido.listings(seller_id,id),
  FOREIGN KEY (seller_id,seller_kind) REFERENCES treido.seller_accounts(id,kind),
  CHECK (mode = 'unique' OR seller_kind = 'business')
);
CREATE TABLE treido.inventory_skus (
  id uuid PRIMARY KEY,
  seller_id uuid NOT NULL, listing_id uuid NOT NULL,
  mode text NOT NULL CHECK (mode IN ('unique','stocked')),
  seller_sku varchar(64) NOT NULL DEFAULT '',
  options jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(options) = 'object'),
  option_key varchar(64) NOT NULL CHECK (option_key ~ '^[0-9a-f]{64}$'),
  price_minor integer CHECK (price_minor BETWEEN 0 AND 1000000000),
  currency text NOT NULL DEFAULT 'EUR' CHECK (currency = 'EUR'),
  on_hand integer NOT NULL CHECK (on_hand BETWEEN 0 AND 1000000),
  sold integer NOT NULL DEFAULT 0 CHECK (sold >= 0),
  active boolean NOT NULL DEFAULT true,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (seller_id,listing_id,id),
  FOREIGN KEY (seller_id,listing_id,mode) REFERENCES treido.inventory_catalogues(seller_id,listing_id,mode),
  CHECK (mode <> 'unique' OR (on_hand <= 1 AND options = '{}'::jsonb))
);
CREATE UNIQUE INDEX inventory_option_unique ON treido.inventory_skus(seller_id,listing_id,option_key) WHERE active;
CREATE UNIQUE INDEX inventory_single_unique ON treido.inventory_skus(listing_id) WHERE active AND mode='unique';
CREATE UNIQUE INDEX inventory_seller_code ON treido.inventory_skus(seller_id,lower(btrim(seller_sku))) WHERE active AND seller_sku<>'';
CREATE INDEX inventory_seller_listing ON treido.inventory_skus(seller_id,listing_id,id);
CREATE TABLE treido.inventory_publications (
  seller_id uuid NOT NULL, listing_id uuid NOT NULL, publication_revision integer NOT NULL,
  mode text NOT NULL CHECK (mode IN ('unique','stocked')),
  inventory_revision integer NOT NULL CHECK (inventory_revision > 0),
  PRIMARY KEY (seller_id,listing_id,publication_revision),
  FOREIGN KEY (seller_id,listing_id,publication_revision) REFERENCES treido.listing_publications(seller_id,listing_id,revision)
);
CREATE TABLE treido.inventory_publication_skus (
  seller_id uuid NOT NULL, listing_id uuid NOT NULL, publication_revision integer NOT NULL,
  sku_id uuid NOT NULL, options jsonb NOT NULL CHECK (jsonb_typeof(options)='object'),
  price_minor integer NOT NULL CHECK (price_minor BETWEEN 0 AND 1000000000),
  currency text NOT NULL CHECK (currency='EUR'),
  PRIMARY KEY (seller_id,listing_id,publication_revision,sku_id),
  FOREIGN KEY (seller_id,listing_id,publication_revision) REFERENCES treido.inventory_publications(seller_id,listing_id,publication_revision),
  FOREIGN KEY (seller_id,listing_id,sku_id) REFERENCES treido.inventory_skus(seller_id,listing_id,id)
);
CREATE TABLE treido.inventory_allocations (
  id uuid PRIMARY KEY,
  seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id),
  buyer_id uuid NOT NULL REFERENCES treido.users(id),
  purpose text NOT NULL CHECK (purpose IN ('offer','checkout')),
  source_id uuid NOT NULL, input_hash varchar(64) NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active','released','expired','consumed','reconciliation')),
  expires_at timestamptz NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  resolution_reference varchar(200),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (purpose,source_id), UNIQUE (seller_id,id),
  CHECK (expires_at > created_at)
);
CREATE INDEX allocation_expiry ON treido.inventory_allocations(expires_at,id) WHERE state='active';
CREATE INDEX allocation_buyer ON treido.inventory_allocations(buyer_id,created_at DESC,id);
CREATE TABLE treido.inventory_allocation_lines (
  allocation_id uuid NOT NULL, seller_id uuid NOT NULL, listing_id uuid NOT NULL, sku_id uuid NOT NULL,
  publication_revision integer NOT NULL, quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  unit_price_minor integer NOT NULL CHECK (unit_price_minor BETWEEN 0 AND 1000000000),
  currency text NOT NULL CHECK (currency='EUR'),
  PRIMARY KEY (allocation_id,sku_id),
  FOREIGN KEY (seller_id,allocation_id) REFERENCES treido.inventory_allocations(seller_id,id),
  FOREIGN KEY (seller_id,listing_id,publication_revision,sku_id) REFERENCES treido.inventory_publication_skus(seller_id,listing_id,publication_revision,sku_id)
);
CREATE INDEX allocation_sku ON treido.inventory_allocation_lines(sku_id,allocation_id);
CREATE TABLE treido.inventory_events (
  id uuid PRIMARY KEY, seller_id uuid NOT NULL, listing_id uuid NOT NULL, sku_id uuid NOT NULL,
  actor_id uuid REFERENCES treido.users(id), allocation_id uuid,
  kind text NOT NULL CHECK (kind IN ('setup','adjustment','reported_sale','restock','reserve','release','expire','consume','reconcile')),
  quantity integer NOT NULL CHECK (quantity BETWEEN -1000000 AND 1000000),
  on_hand_after integer NOT NULL CHECK (on_hand_after BETWEEN 0 AND 1000000),
  reason varchar(300) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (seller_id,listing_id,sku_id) REFERENCES treido.inventory_skus(seller_id,listing_id,id),
  FOREIGN KEY (seller_id,allocation_id) REFERENCES treido.inventory_allocations(seller_id,id)
);
CREATE INDEX inventory_history ON treido.inventory_events(seller_id,listing_id,created_at DESC,id DESC);
CREATE TABLE treido.inventory_command_receipts (
  seller_id uuid NOT NULL, listing_id uuid NOT NULL, actor_id uuid NOT NULL REFERENCES treido.users(id),
  request_id uuid NOT NULL, input_hash varchar(64) NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  result jsonb NOT NULL CHECK (jsonb_typeof(result)='object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (seller_id,listing_id,actor_id,request_id),
  FOREIGN KEY (seller_id,listing_id) REFERENCES treido.listings(seller_id,id)
);
