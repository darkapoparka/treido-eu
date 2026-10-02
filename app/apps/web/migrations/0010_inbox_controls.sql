CREATE TABLE treido.contact_preferences (
  seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id),
  buyer_id uuid NOT NULL REFERENCES treido.users(id),
  buyer_blocked boolean NOT NULL DEFAULT false,
  seller_blocked boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 1 CHECK(revision > 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(seller_id,buyer_id)
);
INSERT INTO treido.contact_preferences(seller_id,buyer_id)
  SELECT DISTINCT seller_id,buyer_id FROM treido.conversation_threads;
ALTER TABLE treido.conversation_threads ADD CONSTRAINT conversation_contact
  FOREIGN KEY(seller_id,buyer_id) REFERENCES treido.contact_preferences(seller_id,buyer_id);
ALTER TABLE treido.conversation_threads ADD COLUMN last_message_at timestamptz NOT NULL DEFAULT clock_timestamp();
UPDATE treido.conversation_threads c SET last_message_at=coalesce(
  (SELECT max(created_at) FROM treido.messages WHERE thread_id=c.id), c.created_at);
CREATE INDEX conversation_buyer_activity ON treido.conversation_threads(buyer_id,last_message_at DESC,id DESC);
CREATE INDEX conversation_seller_activity ON treido.conversation_threads(seller_id,last_message_at DESC,id DESC);
CREATE TABLE treido.conversation_read_cursors (
  thread_id uuid NOT NULL REFERENCES treido.conversation_threads(id),
  user_id uuid NOT NULL REFERENCES treido.users(id),
  last_sequence integer NOT NULL CHECK(last_sequence >= 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(thread_id,user_id)
);
CREATE TABLE treido.contact_preference_receipts (
  seller_id uuid NOT NULL, buyer_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES treido.users(id), request_id uuid NOT NULL,
  input_hash varchar(64) NOT NULL CHECK(input_hash ~ '^[0-9a-f]{64}$'),
  accepted_revision integer NOT NULL CHECK(accepted_revision > 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(seller_id,buyer_id,actor_id,request_id),
  FOREIGN KEY(seller_id,buyer_id) REFERENCES treido.contact_preferences(seller_id,buyer_id)
);
-- Durable, content-free notification intent. In-app unread is available now;
-- external mail/push delivery must use a separately qualified consumer.
CREATE TABLE treido.message_notification_intents (
  thread_id uuid NOT NULL, message_id uuid PRIMARY KEY,
  recipient_side text NOT NULL CHECK(recipient_side IN ('buyer','seller')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(thread_id,message_id) REFERENCES treido.messages(thread_id,id)
);
INSERT INTO treido.message_notification_intents(thread_id,message_id,recipient_side)
  SELECT m.thread_id,m.id,CASE WHEN m.author_id=c.buyer_id THEN 'seller' ELSE 'buyer' END
  FROM treido.messages m JOIN treido.conversation_threads c ON c.id=m.thread_id;
