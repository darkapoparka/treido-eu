CREATE SCHEMA treido;
CREATE TABLE treido.users (
  id uuid PRIMARY KEY, clerk_subject varchar(128) NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','restricted','closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE treido.seller_accounts (
  id uuid PRIMARY KEY, kind text NOT NULL CHECK (kind IN ('personal','business')),
  name varchar(80) NOT NULL, status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','restricted','closed')),
  created_by uuid NOT NULL REFERENCES treido.users(id), creation_key uuid, creation_hash varchar(64),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,kind), UNIQUE (created_by,creation_key)
);
CREATE TABLE treido.personal_seller_owners (
  seller_id uuid PRIMARY KEY, user_id uuid NOT NULL UNIQUE REFERENCES treido.users(id),
  seller_kind text NOT NULL DEFAULT 'personal' CHECK (seller_kind = 'personal'),
  FOREIGN KEY (seller_id,seller_kind) REFERENCES treido.seller_accounts(id,kind)
);
CREATE TABLE treido.seller_memberships (
  seller_id uuid NOT NULL, user_id uuid NOT NULL REFERENCES treido.users(id),
  seller_kind text NOT NULL DEFAULT 'business' CHECK (seller_kind = 'business'),
  role text NOT NULL CHECK (role IN ('owner','manager','member')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  grants jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(grants) = 'array'), revision integer NOT NULL DEFAULT 1,
  PRIMARY KEY(seller_id,user_id), FOREIGN KEY(seller_id,seller_kind) REFERENCES treido.seller_accounts(id,kind)
);
CREATE INDEX membership_user ON treido.seller_memberships(user_id,status);
CREATE TABLE treido.seller_usage (
  seller_id uuid PRIMARY KEY REFERENCES treido.seller_accounts(id),
  plan_id text NOT NULL CHECK (plan_id IN ('personal_free','business_free')),
  plan_version integer NOT NULL DEFAULT 1 CHECK (plan_version = 1),
  draft_count integer NOT NULL DEFAULT 0 CHECK (draft_count >= 0)
);
CREATE TABLE treido.listings (
  id uuid PRIMARY KEY, seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id),
  publication text NOT NULL DEFAULT 'draft' CHECK (publication IN ('draft','published','withdrawn')),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(seller_id,id)
);
CREATE TABLE treido.listing_drafts (
  listing_id uuid PRIMARY KEY, seller_id uuid NOT NULL, payload jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0), category_policy_version integer,
  created_by uuid NOT NULL REFERENCES treido.users(id), creation_key uuid NOT NULL, creation_hash varchar(64) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(seller_id,created_by,creation_key), FOREIGN KEY(seller_id,listing_id) REFERENCES treido.listings(seller_id,id)
);
CREATE INDEX draft_seller_updated ON treido.listing_drafts(seller_id,updated_at,listing_id);
CREATE TABLE treido.draft_save_receipts (
  seller_id uuid NOT NULL, listing_id uuid NOT NULL, user_id uuid NOT NULL REFERENCES treido.users(id),
  request_id uuid NOT NULL, input_hash varchar(64) NOT NULL, accepted_revision integer NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(seller_id,listing_id,user_id,request_id),
  FOREIGN KEY(seller_id,listing_id) REFERENCES treido.listings(seller_id,id)
);
