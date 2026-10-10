-- Private human support is separate from merchant financial aftercare.
-- No operator grant, policy approval, recipient address or external delivery seed.
CREATE TABLE treido.support_tickets (
 id uuid PRIMARY KEY,
 requester_id uuid NOT NULL REFERENCES treido.users(id),
 topic text NOT NULL CHECK(topic IN ('account','safety','technical','other')),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 3 AND 120),
 state text NOT NULL DEFAULT 'open' CHECK(state IN ('open','waiting','resolved')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 last_sequence integer NOT NULL DEFAULT 1 CHECK(last_sequence>0),
 public_sequence integer NOT NULL DEFAULT 1 CHECK(public_sequence BETWEEN 1 AND last_sequence),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(id,requester_id)
);
CREATE INDEX support_own_queue ON treido.support_tickets(requester_id,created_at DESC,id DESC);
CREATE INDEX support_operator_queue ON treido.support_tickets(state,created_at DESC,id DESC);
CREATE TABLE treido.support_entries (
 ticket_id uuid NOT NULL REFERENCES treido.support_tickets(id),
 sequence integer NOT NULL CHECK(sequence>0),
 author_id uuid NOT NULL REFERENCES treido.users(id),
 author_side text NOT NULL CHECK(author_side IN ('requester','operator')),
 kind text NOT NULL CHECK(kind IN ('create','reply','note','resolve','reopen')),
 audience text NOT NULL CHECK(audience IN ('requester','operator')),
 body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 4000),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(ticket_id,sequence),
 CHECK((kind='note' AND audience='operator' AND author_side='operator') OR (kind<>'note' AND audience='requester')),
 CHECK(kind<>'create' OR (sequence=1 AND author_side='requester'))
);
CREATE INDEX support_author_rate ON treido.support_entries(author_id,created_at DESC);
CREATE TABLE treido.support_command_receipts (
 actor_id uuid NOT NULL REFERENCES treido.users(id),
 request_id uuid NOT NULL,
 ticket_id uuid NOT NULL REFERENCES treido.support_tickets(id),
 input_hash text NOT NULL CHECK(input_hash ~ '^[a-f0-9]{64}$'),
 result jsonb NOT NULL CHECK(jsonb_typeof(result)='object'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(actor_id,request_id)
);
CREATE TABLE treido.support_read_cursors (
 ticket_id uuid NOT NULL REFERENCES treido.support_tickets(id),
 user_id uuid NOT NULL REFERENCES treido.users(id),
 sequence integer NOT NULL CHECK(sequence>0),
 PRIMARY KEY(ticket_id,user_id)
);
CREATE TABLE treido.support_notifications (
 ticket_id uuid NOT NULL,
 sequence integer NOT NULL,
 user_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(ticket_id,sequence,user_id),
 FOREIGN KEY(ticket_id,user_id) REFERENCES treido.support_tickets(id,requester_id),
 FOREIGN KEY(ticket_id,sequence) REFERENCES treido.support_entries(ticket_id,sequence)
);
CREATE INDEX support_notification_recipient ON treido.support_notifications(user_id,created_at DESC,ticket_id,sequence);
CREATE FUNCTION treido.guard_support_ticket_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,treido,pg_temp AS $$
BEGIN
 IF ROW(NEW.id,NEW.requester_id,NEW.topic,NEW.title,NEW.created_at)
  IS DISTINCT FROM ROW(OLD.id,OLD.requester_id,OLD.topic,OLD.title,OLD.created_at)
  OR NEW.revision<>OLD.revision+1 OR NEW.last_sequence<>OLD.last_sequence+1
  OR NEW.public_sequence<OLD.public_sequence THEN
  RAISE EXCEPTION 'Support identity and sequence are immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION treido.support_keep_evidence() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,treido,pg_temp AS $$
BEGIN
 RAISE EXCEPTION 'Support evidence is immutable' USING ERRCODE='23514';
END $$;
CREATE TRIGGER support_ticket_identity BEFORE UPDATE ON treido.support_tickets FOR EACH ROW EXECUTE FUNCTION treido.guard_support_ticket_identity();
CREATE TRIGGER support_entry_immutable BEFORE UPDATE OR DELETE ON treido.support_entries FOR EACH ROW EXECUTE FUNCTION treido.support_keep_evidence();
CREATE TRIGGER support_receipt_immutable BEFORE UPDATE OR DELETE ON treido.support_command_receipts FOR EACH ROW EXECUTE FUNCTION treido.support_keep_evidence();
CREATE TRIGGER support_notice_immutable BEFORE UPDATE OR DELETE ON treido.support_notifications FOR EACH ROW EXECUTE FUNCTION treido.support_keep_evidence();
REVOKE ALL ON treido.support_tickets,treido.support_entries,treido.support_command_receipts,treido.support_read_cursors,treido.support_notifications FROM PUBLIC;
REVOKE ALL ON FUNCTION treido.guard_support_ticket_identity(),treido.support_keep_evidence() FROM PUBLIC;
-- These are retained support/case evidence, not optional library or profile data.
-- Existing approved account-closure functions cannot delete them incidentally.
