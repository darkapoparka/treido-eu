CREATE TABLE treido.signup_intents (
  user_id uuid PRIMARY KEY REFERENCES treido.users(id),
  intent text CHECK (intent IN ('buy','personal','business')),
  revision integer NOT NULL CHECK (revision > 0),
  last_request_id uuid NOT NULL, last_input_hash varchar(64) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE treido.seller_profiles (
  seller_id uuid PRIMARY KEY REFERENCES treido.seller_accounts(id),
  description varchar(1200) NOT NULL DEFAULT '', locality varchar(100) NOT NULL DEFAULT ''
);
CREATE TABLE treido.seller_onboarding_progress (
  seller_id uuid PRIMARY KEY, seller_kind text NOT NULL DEFAULT 'business' CHECK (seller_kind = 'business'),
  revision integer NOT NULL CHECK (revision > 0),
  last_step text NOT NULL CHECK (last_step IN ('details','declaration','review')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(seller_id,seller_kind) REFERENCES treido.seller_accounts(id,kind)
);
-- Every edit appends an immutable declaration snapshot. Review is a separate
-- operator command; seller submission can only request review, never accept it.
CREATE TABLE treido.seller_declarations (
  id uuid PRIMARY KEY, seller_id uuid NOT NULL,
  seller_kind text NOT NULL DEFAULT 'business' CHECK (seller_kind = 'business'),
  revision integer NOT NULL CHECK (revision > 0),
  requirement_version integer NOT NULL CHECK (requirement_version > 0),
  country varchar(2) NOT NULL CHECK (country = 'BG'),
  legal_name varchar(160) NOT NULL, registration_number varchar(40) NOT NULL,
  contact_email varchar(254) NOT NULL, contact_address varchar(500) NOT NULL,
  accurate boolean NOT NULL,
  status text NOT NULL CHECK (status IN ('draft','review_required','accepted','rejected')),
  submitted_by uuid NOT NULL REFERENCES treido.users(id),
  created_at timestamptz NOT NULL DEFAULT now(), submitted_at timestamptz,
  UNIQUE(seller_id,revision), UNIQUE(seller_id,id),
  FOREIGN KEY(seller_id,seller_kind) REFERENCES treido.seller_accounts(id,kind),
  CHECK (status = 'draft' OR (accurate AND length(legal_name) >= 2 AND
    length(registration_number) >= 2 AND length(contact_email) > 0 AND
    length(contact_address) >= 5 AND submitted_at IS NOT NULL))
);
CREATE TABLE treido.seller_setup_receipts (
  seller_id uuid NOT NULL REFERENCES treido.seller_onboarding_progress(seller_id),
  user_id uuid NOT NULL REFERENCES treido.users(id), request_id uuid NOT NULL,
  input_hash varchar(64) NOT NULL, accepted_revision integer NOT NULL CHECK (accepted_revision > 0),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(seller_id,user_id,request_id)
);
