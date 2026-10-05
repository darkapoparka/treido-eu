-- Team capacity is serialized by the existing seller lock; pending unexpired invitations reserve a seat.
CREATE TABLE treido.seller_team_state (
  seller_id uuid PRIMARY KEY REFERENCES treido.seller_accounts(id),
  revision integer NOT NULL DEFAULT 0 CHECK(revision>=0)
);
CREATE TABLE treido.seller_invitations (
  id uuid PRIMARY KEY,
  seller_id uuid NOT NULL,
  seller_kind text NOT NULL DEFAULT 'business' CHECK(seller_kind='business'),
  recipient varchar(254) NOT NULL CHECK(recipient=lower(btrim(recipient)) AND recipient LIKE '%@%'),
  role text NOT NULL CHECK(role IN ('manager','member')),
  grants jsonb NOT NULL CHECK(jsonb_typeof(grants)='array'),
  language text NOT NULL CHECK(language IN ('bg','en')),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','cancelled','expired')),
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  created_by uuid NOT NULL REFERENCES treido.users(id),
  accepted_by uuid REFERENCES treido.users(id),
  accepted_membership_revision integer,
  expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '7 days',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  accepted_at timestamptz,
  UNIQUE(seller_id,id),
  FOREIGN KEY(seller_id,seller_kind) REFERENCES treido.seller_accounts(id,kind),
  CHECK((status='accepted')=(accepted_by IS NOT NULL)),
  CHECK((accepted_by IS NULL)=(accepted_membership_revision IS NULL))
);
CREATE INDEX seller_invitation_recipient ON treido.seller_invitations(recipient,status,expires_at);
CREATE INDEX seller_invitation_team ON treido.seller_invitations(seller_id,created_at DESC,id DESC);
CREATE TABLE treido.team_command_receipts (
  seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id),
  actor_id uuid NOT NULL REFERENCES treido.users(id), request_id uuid NOT NULL,
  input_hash varchar(64) NOT NULL CHECK(input_hash ~ '^[0-9a-f]{64}$'),
  result_id uuid NOT NULL, accepted_revision integer NOT NULL CHECK(accepted_revision>0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(seller_id,actor_id,request_id)
);
CREATE TABLE treido.invitation_deliveries (
  id uuid PRIMARY KEY, seller_id uuid NOT NULL, invitation_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES treido.users(id),
  seller_name varchar(80) NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','submitted','unavailable','uncertain','cancelled')),
  provider_id varchar(160),
  request_payload jsonb CHECK(jsonb_typeof(request_payload)='object'),
  first_attempt_at timestamptz, submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(seller_id,id),
  FOREIGN KEY(seller_id,invitation_id) REFERENCES treido.seller_invitations(seller_id,id)
);
CREATE INDEX invitation_delivery_recent ON treido.invitation_deliveries(invitation_id,created_at DESC);
ALTER TABLE treido.outbox_jobs DROP CONSTRAINT outbox_jobs_kind_check;
ALTER TABLE treido.outbox_jobs ADD CONSTRAINT outbox_jobs_kind_check CHECK(kind IN ('media.process','system.probe','catalogue.import','team.invitation'));
ALTER TABLE treido.outbox_jobs ADD CONSTRAINT invitation_job_member CHECK(kind<>'team.invitation' OR authority='member');

-- Independent revisions and explicit public data, never copied from trader declarations.
CREATE TABLE treido.seller_service_settings (
  seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id),
  section text NOT NULL CHECK(section IN ('contact','delivery')),
  revision integer NOT NULL CHECK(revision>0),
  payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
  updated_by uuid NOT NULL REFERENCES treido.users(id),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(seller_id,section)
);
CREATE TABLE treido.seller_service_receipts (
  seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id),
  section text NOT NULL CHECK(section IN ('contact','delivery')),
  actor_id uuid NOT NULL REFERENCES treido.users(id), request_id uuid NOT NULL,
  input_hash varchar(64) NOT NULL CHECK(input_hash ~ '^[0-9a-f]{64}$'),
  accepted_revision integer NOT NULL CHECK(accepted_revision>0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(seller_id,section,actor_id,request_id)
);
