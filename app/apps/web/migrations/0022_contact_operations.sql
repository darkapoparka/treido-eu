-- Contact workflow only: no payable quotes, payment attempts, orders or new holds.
ALTER TABLE treido.purchase_reviews ADD CONSTRAINT purchase_review_buyer_identity UNIQUE(buyer_id,id);

CREATE TABLE treido.purchase_review_renewals (
  previous_review_id uuid PRIMARY KEY,
  next_review_id uuid NOT NULL UNIQUE,
  buyer_id uuid NOT NULL REFERENCES treido.users(id),
  seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id),
  request_id uuid NOT NULL,
  input_hash varchar(64) NOT NULL CHECK(input_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(buyer_id,request_id),
  FOREIGN KEY(buyer_id,previous_review_id) REFERENCES treido.purchase_reviews(buyer_id,id),
  FOREIGN KEY(buyer_id,next_review_id) REFERENCES treido.purchase_reviews(buyer_id,id),
  FOREIGN KEY(seller_id,previous_review_id) REFERENCES treido.purchase_reviews(seller_id,id),
  FOREIGN KEY(seller_id,next_review_id) REFERENCES treido.purchase_reviews(seller_id,id),
  CHECK(previous_review_id<>next_review_id)
);

-- A state row is created only by an authorized command after matching the exact
-- explicitly sent review message. Reads never create workflow state. No buyer
-- preferences/private notes are copied into these merchant tables.
CREATE TABLE treido.merchant_inquiry_state (
  review_id uuid PRIMARY KEY,
  seller_id uuid NOT NULL,
  thread_id uuid NOT NULL REFERENCES treido.conversation_threads(id),
  message_id uuid NOT NULL REFERENCES treido.messages(id),
  status text NOT NULL DEFAULT 'new' CHECK(status IN ('new','in_progress','waiting_buyer','resolved','closed')),
  revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
  updated_by uuid NOT NULL REFERENCES treido.users(id),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(seller_id,review_id),
  FOREIGN KEY(seller_id,review_id) REFERENCES treido.purchase_reviews(seller_id,id)
);
CREATE INDEX merchant_inquiry_status ON treido.merchant_inquiry_state(seller_id,status,review_id);
CREATE TABLE treido.merchant_inquiry_receipts (
  review_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES treido.users(id),
  request_id uuid NOT NULL,
  input_hash varchar(64) NOT NULL CHECK(input_hash ~ '^[0-9a-f]{64}$'),
  kind text NOT NULL CHECK(kind IN ('status','reply')),
  from_status text NOT NULL CHECK(from_status IN ('new','in_progress','waiting_buyer','resolved','closed')),
  to_status text NOT NULL CHECK(to_status IN ('new','in_progress','waiting_buyer','resolved','closed')),
  accepted_revision integer NOT NULL CHECK(accepted_revision>0),
  reply_message_id uuid REFERENCES treido.messages(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(review_id,actor_id,request_id),
  UNIQUE(review_id,accepted_revision),
  FOREIGN KEY(seller_id,review_id) REFERENCES treido.merchant_inquiry_state(seller_id,review_id),
  CHECK((kind='reply')=(reply_message_id IS NOT NULL))
);

-- One receipt commits with each existing offer cancellation transaction. It is
-- historical acknowledgement, not authority to repeat a release after new work.
CREATE TABLE treido.reservation_cancellation_receipts (
  actor_id uuid NOT NULL REFERENCES treido.users(id),
  request_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  operating_seller_id uuid REFERENCES treido.seller_accounts(id),
  allocation_id uuid NOT NULL,
  thread_id uuid NOT NULL REFERENCES treido.conversation_threads(id),
  offer_id uuid NOT NULL REFERENCES treido.listing_offers(id),
  input_hash varchar(64) NOT NULL CHECK(input_hash ~ '^[0-9a-f]{64}$'),
  accepted_revision integer NOT NULL CHECK(accepted_revision>0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(actor_id,request_id),
  FOREIGN KEY(seller_id,allocation_id) REFERENCES treido.inventory_allocations(seller_id,id),
  CHECK(operating_seller_id IS NULL OR operating_seller_id=seller_id)
);
CREATE INDEX reservation_cancellation_resource ON treido.reservation_cancellation_receipts(allocation_id,actor_id);

-- Match explicitly sent reviews without scanning unrelated conversation history.
CREATE INDEX purchase_review_sent_message ON treido.messages(request_id,author_id,thread_id) WHERE offer_event_id IS NULL;

-- Database-level seller/thread/message scope in addition to command authorization.
ALTER TABLE treido.conversation_threads ADD CONSTRAINT conversation_inquiry_seller UNIQUE(seller_id,id);
ALTER TABLE treido.merchant_inquiry_state
  ADD CONSTRAINT inquiry_seller_thread FOREIGN KEY(seller_id,thread_id) REFERENCES treido.conversation_threads(seller_id,id),
  ADD CONSTRAINT inquiry_thread_message FOREIGN KEY(thread_id,message_id) REFERENCES treido.messages(thread_id,id);
ALTER TABLE treido.reservation_cancellation_receipts
  ADD CONSTRAINT cancellation_seller_thread FOREIGN KEY(seller_id,thread_id) REFERENCES treido.conversation_threads(seller_id,id),
  ADD CONSTRAINT cancellation_thread_offer FOREIGN KEY(thread_id,offer_id) REFERENCES treido.listing_offers(thread_id,id);
