CREATE TABLE treido.moderation_actions (
  id uuid PRIMARY KEY, listing_id uuid NOT NULL REFERENCES treido.listings(id),
  actor_id uuid NOT NULL REFERENCES treido.users(id), report_id uuid REFERENCES treido.reports(id),
  prior_state text NOT NULL CHECK(prior_state IN ('clear','restricted','removed')),
  next_state text NOT NULL CHECK(next_state IN ('clear','restricted','removed')),
  prior_revision integer NOT NULL CHECK(prior_revision > 0), accepted_revision integer NOT NULL CHECK(accepted_revision=prior_revision+1),
  reason varchar(2000) NOT NULL CHECK(btrim(reason)<>''), request_id uuid NOT NULL, input_hash varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(actor_id,request_id), UNIQUE(listing_id,accepted_revision)
);
CREATE TABLE treido.moderation_appeals (
  id uuid PRIMARY KEY, action_id uuid NOT NULL REFERENCES treido.moderation_actions(id),
  actor_id uuid NOT NULL REFERENCES treido.users(id), details varchar(2000) NOT NULL CHECK(btrim(details)<>''),
  request_id uuid NOT NULL, input_hash varchar(64) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(actor_id,request_id)
);
