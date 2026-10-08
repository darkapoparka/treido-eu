-- A trader declaration decision appends facts; it never edits the submitted snapshot.
-- Review acceptance is distinct from verification, warranty and payment readiness.
CREATE TABLE treido.seller_declaration_reviews (
  id uuid PRIMARY KEY,
  seller_id uuid NOT NULL REFERENCES treido.seller_accounts(id),
  source_declaration_id uuid NOT NULL,
  source_revision integer NOT NULL CHECK(source_revision>0),
  source_setup_revision integer NOT NULL CHECK(source_setup_revision>0),
  requirement_version integer NOT NULL CHECK(requirement_version>0),
  reviewed_declaration_id uuid NOT NULL,
  reviewed_revision integer NOT NULL CHECK(reviewed_revision>0),
  actor_id uuid NOT NULL REFERENCES treido.users(id),
  request_id uuid NOT NULL,
  input_hash varchar(64) NOT NULL CHECK(input_hash ~ '^[a-f0-9]{64}$'),
  decision text NOT NULL CHECK(decision IN ('accepted','rejected')),
  reason varchar(2000) NOT NULL CHECK(length(btrim(reason)) BETWEEN 2 AND 2000 AND reason=btrim(reason)),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(actor_id,request_id),
  UNIQUE(seller_id,source_declaration_id),
  UNIQUE(seller_id,reviewed_declaration_id),
  CHECK(source_declaration_id<>reviewed_declaration_id),
  CHECK(source_revision<=source_setup_revision AND reviewed_revision=source_setup_revision+1),
  FOREIGN KEY(seller_id,source_declaration_id) REFERENCES treido.seller_declarations(seller_id,id),
  FOREIGN KEY(seller_id,reviewed_declaration_id) REFERENCES treido.seller_declarations(seller_id,id),
  FOREIGN KEY(seller_id,source_revision) REFERENCES treido.seller_declarations(seller_id,revision),
  FOREIGN KEY(seller_id,reviewed_revision) REFERENCES treido.seller_declarations(seller_id,revision)
);
CREATE INDEX seller_declaration_review_history ON treido.seller_declaration_reviews(seller_id,created_at DESC,id);

CREATE FUNCTION treido.guard_seller_declaration_review() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,treido AS $$
DECLARE source treido.seller_declarations%ROWTYPE;
 reviewed treido.seller_declarations%ROWTYPE;
 latest_id uuid;
 prior_id uuid;
 setup_revision integer;
BEGIN
  IF TG_OP<>'INSERT' THEN
    RAISE EXCEPTION 'Declaration reviews are immutable' USING ERRCODE='42501';
  END IF;
  PERFORM id FROM treido.users WHERE id=NEW.actor_id AND status='active' FOR SHARE;
  IF NOT FOUND OR NOT treido.lock_operator_grant(NEW.actor_id,'reports.read')
    OR NOT treido.lock_operator_grant(NEW.actor_id,'moderation.write') THEN
    RAISE EXCEPTION 'Current declaration review authority required' USING ERRCODE='42501';
  END IF;
  PERFORM id FROM treido.seller_accounts WHERE id=NEW.seller_id AND kind='business' AND status='active' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Current business required' USING ERRCODE='42501';
  END IF;
  SELECT revision INTO setup_revision FROM treido.seller_onboarding_progress WHERE seller_id=NEW.seller_id FOR SHARE;
  -- The business/setup locks serialize submit/review; runtime cannot UPDATE declaration facts.
  SELECT * INTO source FROM treido.seller_declarations WHERE seller_id=NEW.seller_id AND id=NEW.source_declaration_id;
  SELECT * INTO reviewed FROM treido.seller_declarations WHERE seller_id=NEW.seller_id AND id=NEW.reviewed_declaration_id;
  SELECT id INTO latest_id FROM treido.seller_declarations WHERE seller_id=NEW.seller_id ORDER BY revision DESC LIMIT 1;
  SELECT id INTO prior_id FROM treido.seller_declarations WHERE seller_id=NEW.seller_id AND id<>NEW.reviewed_declaration_id ORDER BY revision DESC LIMIT 1;
  IF source.id IS NULL OR reviewed.id IS NULL OR setup_revision IS DISTINCT FROM NEW.reviewed_revision
    OR latest_id IS DISTINCT FROM reviewed.id OR prior_id IS DISTINCT FROM source.id
    OR source.revision IS DISTINCT FROM NEW.source_revision
    OR source.status IS DISTINCT FROM 'review_required' OR source.country IS DISTINCT FROM 'BG'
    OR NEW.requirement_version<>1 OR source.requirement_version IS DISTINCT FROM NEW.requirement_version
    OR reviewed.revision IS DISTINCT FROM NEW.reviewed_revision
    OR reviewed.status IS DISTINCT FROM NEW.decision
    OR (source.seller_kind,source.requirement_version,source.country,source.legal_name,source.registration_number,
        source.contact_email,source.contact_address,source.accurate,source.submitted_by,source.submitted_at)
       IS DISTINCT FROM
       (reviewed.seller_kind,reviewed.requirement_version,reviewed.country,reviewed.legal_name,reviewed.registration_number,
        reviewed.contact_email,reviewed.contact_address,reviewed.accurate,reviewed.submitted_by,reviewed.submitted_at) THEN
    RAISE EXCEPTION 'Declaration decision must retain the current submitted facts' USING ERRCODE='23514';
  END IF;
  IF NEW.actor_id=source.submitted_by OR EXISTS(
    SELECT 1 FROM treido.seller_memberships WHERE seller_id=NEW.seller_id AND user_id=NEW.actor_id AND status='active'
  ) THEN
    RAISE EXCEPTION 'Independent declaration reviewer required' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER seller_declaration_review_guard BEFORE INSERT OR UPDATE OR DELETE
  ON treido.seller_declaration_reviews FOR EACH ROW EXECUTE FUNCTION treido.guard_seller_declaration_review();
REVOKE ALL ON treido.seller_declaration_reviews FROM PUBLIC;
REVOKE ALL ON FUNCTION treido.guard_seller_declaration_review() FROM PUBLIC;
