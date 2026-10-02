-- Immutable publication snapshots. Legacy draft rows never become public by migration.
ALTER TABLE treido.media_assets ADD CONSTRAINT media_owned_listing_id UNIQUE(seller_id,listing_id,id);
CREATE TABLE treido.listing_publications (
  seller_id uuid NOT NULL, listing_id uuid NOT NULL,
  revision integer NOT NULL CHECK(revision > 1), draft_revision integer NOT NULL CHECK(revision=draft_revision+1),
  actor_id uuid NOT NULL REFERENCES treido.users(id), request_id uuid NOT NULL,
  input_hash varchar(64) NOT NULL CHECK(input_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
  terms jsonb NOT NULL CHECK(jsonb_typeof(terms)='object' AND terms->>'version'='1' AND terms->>'purchaseMode'='contact'),
  seller_kind text NOT NULL CHECK(seller_kind IN ('personal','business')),
  registry_version integer NOT NULL, category_id varchar(120) NOT NULL, category_policy_version integer NOT NULL,
  country varchar(2) NOT NULL CHECK(country='BG'), declaration_revision integer,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(seller_id,listing_id,revision),
  UNIQUE(seller_id,listing_id,actor_id,request_id),
  FOREIGN KEY(seller_id,listing_id) REFERENCES treido.listings(seller_id,id),
  FOREIGN KEY(seller_id,seller_kind) REFERENCES treido.seller_accounts(id,kind),
  FOREIGN KEY(registry_version,category_id,country,category_policy_version) REFERENCES treido.category_policies(registry_version,category_id,country,version),
  FOREIGN KEY(seller_id,declaration_revision) REFERENCES treido.seller_declarations(seller_id,revision),
  CHECK((seller_kind='personal' AND declaration_revision IS NULL AND terms->>'personalSale'='true') OR (seller_kind='business' AND declaration_revision IS NOT NULL))
);
ALTER TABLE treido.listings ADD COLUMN current_publication_revision integer;
ALTER TABLE treido.listings ADD CONSTRAINT listing_current_publication FOREIGN KEY(seller_id,id,current_publication_revision)
  REFERENCES treido.listing_publications(seller_id,listing_id,revision);
CREATE TABLE treido.listing_publication_media (
  seller_id uuid NOT NULL,listing_id uuid NOT NULL,publication_revision integer NOT NULL,
  asset_id uuid NOT NULL,asset_revision integer NOT NULL CHECK(asset_revision>0),
  position integer NOT NULL CHECK(position BETWEEN 0 AND 11),
  checksum varchar(64) NOT NULL CHECK(checksum ~ '^[0-9a-f]{64}$'),
  width integer NOT NULL CHECK(width>0),height integer NOT NULL CHECK(height>0),
  PRIMARY KEY(seller_id,listing_id,publication_revision,asset_id),
  UNIQUE(seller_id,listing_id,publication_revision,position),
  FOREIGN KEY(seller_id,listing_id,publication_revision) REFERENCES treido.listing_publications(seller_id,listing_id,revision),
  FOREIGN KEY(seller_id,listing_id,asset_id) REFERENCES treido.media_assets(seller_id,listing_id,id)
);
CREATE INDEX listing_publication_time ON treido.listing_publications(created_at DESC,listing_id);
CREATE INDEX listing_current_public ON treido.listings(seller_id,id,current_publication_revision) WHERE publication='published' AND moderation_state='clear';

-- A runtime writer may lock policy facts, but cannot edit or approve them.
CREATE FUNCTION treido.lock_publication_policy(registry integer, category text, country_code text, policy_version integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,treido AS $$
BEGIN
  PERFORM 1 FROM treido.category_policies WHERE registry_version=registry AND category_id=category AND country=country_code AND version=policy_version FOR SHARE;
END $$;
REVOKE ALL ON FUNCTION treido.lock_publication_policy(integer,text,text,integer) FROM PUBLIC;
