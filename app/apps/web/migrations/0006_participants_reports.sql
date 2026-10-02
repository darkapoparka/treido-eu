ALTER TABLE treido.listings ADD COLUMN moderation_state text NOT NULL DEFAULT 'clear' CHECK(moderation_state IN ('clear','restricted','removed'));
ALTER TABLE treido.listings ADD COLUMN moderation_revision integer NOT NULL DEFAULT 1 CHECK(moderation_revision > 0);
CREATE TABLE treido.conversation_threads (
  id uuid PRIMARY KEY, listing_id uuid NOT NULL, seller_id uuid NOT NULL,
  buyer_id uuid NOT NULL REFERENCES treido.users(id),
  state text NOT NULL DEFAULT 'open' CHECK(state IN ('open','closed')),
  next_sequence integer NOT NULL DEFAULT 1 CHECK(next_sequence > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(seller_id,listing_id) REFERENCES treido.listings(seller_id,id),
  UNIQUE(listing_id,seller_id,buyer_id)
);
CREATE INDEX conversation_buyer ON treido.conversation_threads(buyer_id,created_at,id);
CREATE INDEX conversation_seller ON treido.conversation_threads(seller_id,created_at,id);
CREATE TABLE treido.message_attachments (
  id uuid PRIMARY KEY, thread_id uuid NOT NULL REFERENCES treido.conversation_threads(id),
  created_by uuid NOT NULL REFERENCES treido.users(id),
  state text NOT NULL CHECK(state IN ('staged','ready','removed')),
  content_type text NOT NULL CHECK(content_type IN ('image/jpeg','image/png','image/webp','application/pdf')),
  bytes integer NOT NULL CHECK(bytes BETWEEN 1 AND 12582912),
  object_key varchar(300) NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(thread_id,id)
);
CREATE TABLE treido.messages (
  id uuid PRIMARY KEY, thread_id uuid NOT NULL REFERENCES treido.conversation_threads(id),
  author_id uuid NOT NULL REFERENCES treido.users(id), sequence integer NOT NULL CHECK(sequence > 0),
  body varchar(4000) NOT NULL, request_id uuid NOT NULL, input_hash varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(thread_id,sequence), UNIQUE(thread_id,author_id,request_id),
  UNIQUE(thread_id,id)
);
CREATE TABLE treido.message_attachment_links (
  thread_id uuid NOT NULL, message_id uuid NOT NULL, attachment_id uuid NOT NULL UNIQUE,
  PRIMARY KEY(message_id,attachment_id),
  FOREIGN KEY(thread_id,message_id) REFERENCES treido.messages(thread_id,id),
  FOREIGN KEY(thread_id,attachment_id) REFERENCES treido.message_attachments(thread_id,id)
);
CREATE TABLE treido.operator_grants (
  user_id uuid NOT NULL REFERENCES treido.users(id),
  capability text NOT NULL CHECK(capability IN ('reports.read','moderation.write')),
  active boolean NOT NULL DEFAULT true, revision integer NOT NULL DEFAULT 1 CHECK(revision > 0),
  PRIMARY KEY(user_id,capability)
);
-- A narrow fixed-search-path lock allows current grant checks without granting
-- the runtime permission to create or modify operator authority.
CREATE FUNCTION treido.lock_operator_grant(actor_id uuid, named_capability text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
DECLARE allowed boolean;
BEGIN
  SELECT active INTO allowed FROM treido.operator_grants
    WHERE user_id=actor_id AND capability=named_capability FOR SHARE;
  RETURN coalesce(allowed,false);
END $$;
REVOKE ALL ON FUNCTION treido.lock_operator_grant(uuid,text) FROM PUBLIC;
CREATE TABLE treido.reports (
  id uuid PRIMARY KEY, reporter_id uuid NOT NULL REFERENCES treido.users(id),
  resource_kind text NOT NULL CHECK(resource_kind IN ('listing','message')),
  resource_id uuid NOT NULL, reason text NOT NULL CHECK(reason IN ('unsafe','counterfeit','misleading','abuse','other')),
  details varchar(2000) NOT NULL, request_id uuid NOT NULL, input_hash varchar(64) NOT NULL,
  state text NOT NULL DEFAULT 'open' CHECK(state IN ('open','reviewed')), revision integer NOT NULL DEFAULT 1 CHECK(revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(reporter_id,request_id)
);
CREATE INDEX report_queue ON treido.reports(state,created_at,id);
