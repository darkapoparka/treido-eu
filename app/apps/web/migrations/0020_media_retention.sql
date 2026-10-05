-- Bind newly written media to its actual provider/bucket namespace, without credential material.
-- Legacy unbound objects are not adopted or deleted by this migration.
ALTER TABLE treido.media_assets ADD COLUMN storage_scope varchar(64) CHECK(storage_scope ~ '^[0-9a-f]{64}$');
ALTER TABLE treido.media_assets DROP CONSTRAINT media_assets_error_code_check;
ALTER TABLE treido.media_assets ADD CONSTRAINT media_assets_error_code_check
  CHECK(error_code IN ('invalid_bytes','processing_unavailable','upload_expired'));

-- Register each candidate BEFORE external writes. Tombstones prevent late attachment after deletion starts.
CREATE TABLE treido.media_storage_objects (
  storage_scope varchar(64) NOT NULL CHECK(storage_scope ~ '^[0-9a-f]{64}$'),
  object_key varchar(300) NOT NULL,
  seller_id uuid NOT NULL, listing_id uuid NOT NULL, asset_id uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN ('staging','immutable','ready')),
  state text NOT NULL DEFAULT 'tracked' CHECK(state IN ('tracked','deleting','deleted')),
  write_until timestamptz NOT NULL,
  retain_until timestamptz NOT NULL,
  available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deletion_token uuid, deletion_until timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), deleted_at timestamptz,
  PRIMARY KEY(storage_scope,object_key),
  FOREIGN KEY(seller_id,listing_id,asset_id) REFERENCES treido.media_assets(seller_id,listing_id,id),
  CHECK((state='deleted')=(deleted_at IS NOT NULL)),
  CHECK((deletion_token IS NULL)=(deletion_until IS NULL)),
  CHECK(state='deleting' OR deletion_token IS NULL)
);
CREATE INDEX media_storage_retention ON treido.media_storage_objects(storage_scope,available_at,retain_until,object_key)
  WHERE state<>'deleted';
CREATE INDEX media_storage_asset ON treido.media_storage_objects(seller_id,asset_id);
