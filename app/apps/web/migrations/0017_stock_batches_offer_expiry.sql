CREATE TABLE treido.inventory_batch_receipts (
  seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id),
  actor_id uuid NOT NULL REFERENCES treido.users(id),
  request_id uuid NOT NULL,
  input_hash varchar(64) NOT NULL CHECK(input_hash ~ '^[0-9a-f]{64}$'),
  result jsonb NOT NULL CHECK(jsonb_typeof(result)='object'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(seller_id,actor_id,request_id)
);
-- Timer outcomes are system events, not messages attributed to a fictional human.
ALTER TABLE treido.offer_events ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE treido.offer_events DROP CONSTRAINT offer_events_kind_check;
ALTER TABLE treido.offer_events ADD CONSTRAINT offer_events_kind_check
  CHECK(kind IN ('created','countered','accepted','rejected','withdrawn','cancelled','expired','hold_expired'));
ALTER TABLE treido.offer_events ADD CONSTRAINT offer_event_actor_kind
  CHECK((actor_id IS NULL) = (kind IN ('expired','hold_expired')));
CREATE UNIQUE INDEX offer_expiry_once ON treido.offer_events(offer_id,kind)
  WHERE kind IN ('expired','hold_expired');
CREATE INDEX offer_pending_expiry ON treido.listing_offers(expires_at,thread_id)
  WHERE state='pending';
