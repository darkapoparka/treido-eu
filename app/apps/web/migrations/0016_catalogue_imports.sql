-- Business CSV staging. Temporary upload chunks are private and bounded; no media bucket is made public.
ALTER TABLE treido.outbox_jobs DROP CONSTRAINT outbox_jobs_kind_check;
ALTER TABLE treido.outbox_jobs ADD CONSTRAINT outbox_jobs_kind_check CHECK (kind IN ('media.process','system.probe','catalogue.import'));
ALTER TABLE treido.outbox_jobs ADD CONSTRAINT import_job_member CHECK (kind <> 'catalogue.import' OR authority='member');
CREATE TABLE treido.catalogue_imports (
  id uuid PRIMARY KEY,
  seller_id uuid NOT NULL,
  seller_kind text NOT NULL DEFAULT 'business' CHECK(seller_kind='business'),
  created_by uuid NOT NULL REFERENCES treido.users(id),
  request_id uuid NOT NULL,
  source_name varchar(180) NOT NULL,
  source_hash varchar(64) NOT NULL CHECK(source_hash ~ '^[0-9a-f]{64}$'),
  source_bytes integer NOT NULL CHECK(source_bytes BETWEEN 1 AND 10485760),
  schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version=1),
  state text NOT NULL DEFAULT 'uploading' CHECK(state IN ('uploading','review','queued','processing','paused','completed','cancelled')),
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  total_rows integer NOT NULL DEFAULT 0 CHECK(total_rows BETWEEN 0 AND 1000),
  job_id uuid,
  error_code varchar(60),
  expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '24 hours',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(seller_id,id), UNIQUE(seller_id,created_by,request_id),
  FOREIGN KEY(seller_id,seller_kind) REFERENCES treido.seller_accounts(id,kind),
  FOREIGN KEY(seller_id,job_id) REFERENCES treido.outbox_jobs(seller_id,id)
);
CREATE INDEX catalogue_import_history ON treido.catalogue_imports(seller_id,created_at DESC,id DESC);
CREATE TABLE treido.catalogue_import_chunks (
  seller_id uuid NOT NULL, import_id uuid NOT NULL,
  position integer NOT NULL CHECK(position BETWEEN 0 AND 79),
  bytes integer NOT NULL CHECK(bytes BETWEEN 1 AND 131072),
  checksum varchar(64) NOT NULL CHECK(checksum ~ '^[0-9a-f]{64}$'),
  encoded text NOT NULL CHECK(length(encoded) BETWEEN 4 AND 174764),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(import_id,position),
  FOREIGN KEY(seller_id,import_id) REFERENCES treido.catalogue_imports(seller_id,id)
);
CREATE TABLE treido.catalogue_import_rows (
  seller_id uuid NOT NULL, import_id uuid NOT NULL,
  row_number integer NOT NULL CHECK(row_number BETWEEN 1 AND 1000),
  external_id varchar(128),
  raw jsonb NOT NULL CHECK(jsonb_typeof(raw)='object'),
  payload jsonb CHECK(jsonb_typeof(payload)='object'),
  inventory jsonb CHECK(jsonb_typeof(inventory)='object'),
  errors jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(errors)='array'),
  selected boolean NOT NULL DEFAULT false,
  state text NOT NULL CHECK(state IN ('ready','invalid','created','failed')),
  draft_request_id uuid NOT NULL UNIQUE,
  listing_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(import_id,row_number),
  FOREIGN KEY(seller_id,import_id) REFERENCES treido.catalogue_imports(seller_id,id),
  FOREIGN KEY(seller_id,listing_id) REFERENCES treido.listings(seller_id,id),
  CHECK((state='created')=(listing_id IS NOT NULL))
);
CREATE INDEX catalogue_import_pending ON treido.catalogue_import_rows(import_id,row_number) WHERE selected AND state='ready';
CREATE TABLE treido.catalogue_external_ids (
  seller_id uuid NOT NULL, external_id varchar(128) NOT NULL,
  listing_id uuid NOT NULL, import_id uuid NOT NULL,
  PRIMARY KEY(seller_id,external_id),
  FOREIGN KEY(seller_id,listing_id) REFERENCES treido.listings(seller_id,id),
  FOREIGN KEY(seller_id,import_id) REFERENCES treido.catalogue_imports(seller_id,id)
);
CREATE TABLE treido.catalogue_import_receipts (
  seller_id uuid NOT NULL, import_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES treido.users(id), request_id uuid NOT NULL,
  input_hash varchar(64) NOT NULL CHECK(input_hash ~ '^[0-9a-f]{64}$'),
  accepted_revision integer NOT NULL CHECK(accepted_revision>0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(import_id,actor_id,request_id),
  FOREIGN KEY(seller_id,import_id) REFERENCES treido.catalogue_imports(seller_id,id)
);
