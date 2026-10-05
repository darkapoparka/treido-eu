-- T50 additive proposal. NOT numbered or applied. The payment/schema integrator
-- must reserve the next version and register this source with the checksum runner.
-- Do not execute this file independently or rewrite any already-applied migration.
CREATE UNIQUE INDEX reports_exact_resource ON treido.reports(id,resource_kind,resource_id);
CREATE UNIQUE INDEX moderation_actions_exact_resource ON treido.moderation_actions(id,listing_id,accepted_revision);
CREATE UNIQUE INDEX moderation_actions_exact_listing ON treido.moderation_actions(id,listing_id);
CREATE UNIQUE INDEX moderation_appeals_exact_original ON treido.moderation_appeals(id,action_id);

CREATE TABLE treido.message_moderation_actions (
  id uuid PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES treido.messages(id),
  report_id uuid NOT NULL REFERENCES treido.reports(id),
  resource_kind text NOT NULL DEFAULT 'message' CHECK(resource_kind='message'),
  actor_id uuid NOT NULL REFERENCES treido.users(id),
  prior_revision integer NOT NULL CHECK(prior_revision>0),
  accepted_revision integer NOT NULL CHECK(accepted_revision=prior_revision+1),
  state text NOT NULL CHECK(state IN ('visible','hidden')),
  reason varchar(2000) NOT NULL CHECK(btrim(reason)<>''),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(report_id,resource_kind,message_id) REFERENCES treido.reports(id,resource_kind,resource_id),
  UNIQUE(message_id,accepted_revision),
  UNIQUE(id,message_id,accepted_revision)
);
CREATE INDEX message_moderation_latest ON treido.message_moderation_actions(message_id,accepted_revision DESC);

CREATE TABLE treido.trust_case_decisions (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK(kind IN ('message_report','appeal')),
  case_id uuid NOT NULL,
  report_id uuid UNIQUE REFERENCES treido.reports(id),
  appeal_id uuid UNIQUE REFERENCES treido.moderation_appeals(id),
  resource_id uuid NOT NULL,
  message_id uuid REFERENCES treido.messages(id),
  listing_id uuid REFERENCES treido.listings(id),
  resource_kind text NOT NULL CHECK(resource_kind IN ('message','listing')),
  original_action_id uuid REFERENCES treido.moderation_actions(id),
  message_action_id uuid REFERENCES treido.message_moderation_actions(id),
  listing_action_id uuid REFERENCES treido.moderation_actions(id),
  actor_id uuid NOT NULL REFERENCES treido.users(id),
  request_id uuid NOT NULL,
  input_hash varchar(64) NOT NULL CHECK(length(input_hash)=64),
  prior_revision integer NOT NULL CHECK(prior_revision>0),
  accepted_revision integer NOT NULL CHECK(accepted_revision=prior_revision+1),
  observed_resource_revision integer NOT NULL CHECK(observed_resource_revision>0),
  resource_revision integer NOT NULL CHECK(resource_revision>0),
  outcome text NOT NULL,
  reason varchar(2000) NOT NULL CHECK(btrim(reason)<>''),
  resulting_state text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(kind,case_id), UNIQUE(actor_id,request_id),
  FOREIGN KEY(report_id,resource_kind,resource_id) REFERENCES treido.reports(id,resource_kind,resource_id),
  FOREIGN KEY(appeal_id,original_action_id) REFERENCES treido.moderation_appeals(id,action_id),
  FOREIGN KEY(original_action_id,listing_id) REFERENCES treido.moderation_actions(id,listing_id),
  FOREIGN KEY(message_action_id,message_id,resource_revision) REFERENCES treido.message_moderation_actions(id,message_id,accepted_revision),
  FOREIGN KEY(listing_action_id,listing_id,resource_revision) REFERENCES treido.moderation_actions(id,listing_id,accepted_revision),
  CHECK (
    (kind='message_report' AND report_id IS NOT NULL AND report_id=case_id AND appeal_id IS NULL
      AND message_id IS NOT NULL AND message_id=resource_id AND listing_id IS NULL AND resource_kind='message'
      AND original_action_id IS NULL AND listing_action_id IS NULL
      AND outcome IN ('no_violation','violation_recorded','message_hidden') AND resulting_state IN ('visible','hidden')
      AND ((outcome='message_hidden' AND message_action_id IS NOT NULL AND resulting_state='hidden'
          AND resource_revision=observed_resource_revision+1)
        OR (outcome<>'message_hidden' AND message_action_id IS NULL AND resource_revision=observed_resource_revision)))
    OR
    (kind='appeal' AND appeal_id IS NOT NULL AND appeal_id=case_id AND report_id IS NULL
      AND listing_id IS NOT NULL AND listing_id=resource_id AND message_id IS NULL AND resource_kind='listing'
      AND original_action_id IS NOT NULL AND message_action_id IS NULL AND prior_revision=1
      AND outcome IN ('upheld','revised','dismissed') AND resulting_state IN ('clear','restricted','removed')
      AND ((outcome='revised' AND listing_action_id IS NOT NULL AND resource_revision=observed_resource_revision+1)
        OR (outcome<>'revised' AND listing_action_id IS NULL AND resource_revision=observed_resource_revision)))
  )
);
CREATE INDEX trust_case_decisions_time ON treido.trust_case_decisions(created_at DESC,id DESC);
CREATE INDEX trust_case_decisions_actor ON treido.trust_case_decisions(actor_id,created_at DESC);

-- The existing runtime grant function begins with broad grants. Its integrator
-- MUST call applyTrustCaseGrants from scripts/trust-case-grants.mjs afterwards.
-- No data is seeded, no authority granted and no original evidence is changed.
