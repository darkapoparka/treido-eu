ALTER TABLE treido.conversation_threads ADD COLUMN offer_revision integer NOT NULL DEFAULT 0 CHECK (offer_revision >= 0);
ALTER TABLE treido.conversation_threads ADD CONSTRAINT conversation_offer_owner UNIQUE (id,seller_id,listing_id,buyer_id);
ALTER TABLE treido.inventory_allocations ADD CONSTRAINT allocation_source_owner UNIQUE (id,seller_id,buyer_id,source_id,purpose);
CREATE TABLE treido.listing_offers (
  id uuid PRIMARY KEY,
  thread_id uuid NOT NULL, seller_id uuid NOT NULL, listing_id uuid NOT NULL, buyer_id uuid NOT NULL,
  proposer_id uuid NOT NULL REFERENCES treido.users(id),
  proposer_side text NOT NULL CHECK (proposer_side IN ('buyer','seller')),
  publication_revision integer NOT NULL, sku_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  unit_price_minor integer NOT NULL CHECK (unit_price_minor BETWEEN 1 AND 1000000000),
  currency text NOT NULL DEFAULT 'EUR' CHECK (currency='EUR'),
  expires_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','accepted','rejected','withdrawn','expired','superseded','cancelled')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  sequence integer NOT NULL CHECK (sequence > 0),
  parent_offer_id uuid,
  allocation_id uuid,
  allocation_purpose text NOT NULL DEFAULT 'offer' CHECK (allocation_purpose='offer'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (thread_id,id), UNIQUE (thread_id,sequence),
  FOREIGN KEY (thread_id,seller_id,listing_id,buyer_id) REFERENCES treido.conversation_threads(id,seller_id,listing_id,buyer_id),
  FOREIGN KEY (seller_id,listing_id,publication_revision,sku_id) REFERENCES treido.inventory_publication_skus(seller_id,listing_id,publication_revision,sku_id),
  FOREIGN KEY (thread_id,parent_offer_id) REFERENCES treido.listing_offers(thread_id,id),
  FOREIGN KEY (allocation_id,seller_id,buyer_id,id,allocation_purpose) REFERENCES treido.inventory_allocations(id,seller_id,buyer_id,source_id,purpose),
  CHECK (expires_at>created_at),
  CHECK ((state IN ('accepted','cancelled')) = (allocation_id IS NOT NULL))
);
CREATE UNIQUE INDEX offer_one_pending ON treido.listing_offers(thread_id) WHERE state='pending';
CREATE INDEX offer_history ON treido.listing_offers(thread_id,sequence DESC);
CREATE TABLE treido.offer_events (
  id uuid PRIMARY KEY, thread_id uuid NOT NULL, offer_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES treido.users(id),
  kind text NOT NULL CHECK (kind IN ('created','countered','accepted','rejected','withdrawn','cancelled')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (thread_id,id),
  FOREIGN KEY (thread_id,offer_id) REFERENCES treido.listing_offers(thread_id,id)
);
ALTER TABLE treido.messages ADD COLUMN offer_event_id uuid;
ALTER TABLE treido.messages ADD CONSTRAINT message_offer_event FOREIGN KEY(thread_id,offer_event_id) REFERENCES treido.offer_events(thread_id,id);
CREATE UNIQUE INDEX offer_message_once ON treido.messages(offer_event_id) WHERE offer_event_id IS NOT NULL;
CREATE TABLE treido.offer_command_receipts (
  thread_id uuid NOT NULL, actor_id uuid NOT NULL REFERENCES treido.users(id), request_id uuid NOT NULL,
  input_hash varchar(64) NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  accepted_revision integer NOT NULL CHECK (accepted_revision > 0),
  offer_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (thread_id,actor_id,request_id),
  FOREIGN KEY (thread_id,offer_id) REFERENCES treido.listing_offers(thread_id,id)
);
