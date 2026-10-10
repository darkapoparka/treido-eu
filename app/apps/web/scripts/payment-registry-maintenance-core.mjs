import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { URL } from "node:url";

export class PaymentMaintenanceError extends Error {
  constructor(code) {
    super(code);
    this.name = "PaymentMaintenanceError";
  }
}
const require = (condition, code) => {
  if (!condition) throw new PaymentMaintenanceError(code);
};
const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
function keys(value, names) {
  require(object(value) &&
    Object.keys(value).length === names.length &&
    names.every((name) => Object.hasOwn(value, name)), "INVALID_REVIEW_FIELDS");
}
const canonical = (value) =>
  JSON.stringify(value, (_key, item) =>
    object(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );
const equal = (left, right) => canonical(left) === canonical(right);
export const paymentMaintenanceHash = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
const uuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    value,
  );
const accountId = (value) =>
  typeof value === "string" && /^acct_[A-Za-z0-9]{1,90}$/.test(value);
function text(value, min = 8, max = 500) {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length >= min &&
    value.length <= max &&
    !Array.from(value).some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) &&
    !/(?:placeholder|todo|unapproved|synthetic|fixture|example)/i.test(value)
  );
}
function decision(value) {
  keys(value, ["reference", "reviewedBy", "reviewedAt"]);
  require(text(value.reference) &&
    text(value.reviewedBy, 8, 120) &&
    typeof value.reviewedAt === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.reviewedAt) &&
    Number.isFinite(Date.parse(value.reviewedAt)) &&
    Date.parse(value.reviewedAt) <= Date.now() &&
    new Date(value.reviewedAt).toISOString() ===
      value.reviewedAt, "ACTUAL_REVIEW_DECISION_REQUIRED");
}
export function validatePaymentReview(packet) {
  keys(packet, [
    "format",
    "target",
    "authorizationReference",
    "policy",
    "mapping",
    "listing",
  ]);
  require(packet.format === "treido-test-payment-review-v1" &&
    text(packet.authorizationReference), "REVIEW_AUTHORIZATION_REQUIRED");
  keys(packet.target, [
    "application",
    "environment",
    "projectId",
    "branchId",
    "database",
    "region",
    "runtimeRole",
    "maintenanceRole",
    "country",
    "appOrigin",
    "stripeApplicationId",
    "stripePlatformAccount",
    "livemode",
  ]);
  const target = packet.target;
  require(target.application === "treido-eu" &&
    ["development", "test", "preview"].includes(target.environment) &&
    target.country === "BG" &&
    target.livemode === false &&
    /^[a-z][a-z0-9-]{2,100}$/.test(target.projectId) &&
    /^br-[a-z0-9-]{3,100}$/.test(target.branchId) &&
    /^[a-z0-9-]{3,80}$/.test(target.region) &&
    /^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(target.database) &&
    [target.runtimeRole, target.maintenanceRole].every((role) =>
      /^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(role),
    ) &&
    target.runtimeRole !== target.maintenanceRole &&
    /^[a-z][a-z0-9-]{1,79}$/.test(target.stripeApplicationId) &&
    accountId(target.stripePlatformAccount), "TEST_TARGET_REQUIRED");
  try {
    const origin = new URL(target.appOrigin);
    require(origin.origin === target.appOrigin &&
      !origin.username &&
      !origin.password &&
      (target.environment === "preview"
        ? origin.protocol === "https:"
        : origin.protocol === "http:" &&
          origin.hostname === "127.0.0.1"), "INVALID_APPLICATION_ORIGIN");
  } catch {
    throw new PaymentMaintenanceError("INVALID_APPLICATION_ORIGIN");
  }
  keys(packet.policy, [
    "id",
    "feeBps",
    "feeFixedMinor",
    "settlementMerchant",
    "buyerTerms",
    "decision",
  ]);
  require(uuid(packet.policy.id) &&
    Number.isSafeInteger(packet.policy.feeBps) &&
    packet.policy.feeBps >= 0 &&
    packet.policy.feeBps <= 10000 &&
    Number.isSafeInteger(packet.policy.feeFixedMinor) &&
    packet.policy.feeFixedMinor >= 0 &&
    packet.policy.feeFixedMinor <= 1000000 &&
    ["platform", "seller"].includes(
      packet.policy.settlementMerchant,
    ), "INVALID_PAYMENT_POLICY");
  keys(packet.policy.buyerTerms, ["bg", "en"]);
  require([packet.policy.buyerTerms.bg, packet.policy.buyerTerms.en].every(
    (value) => text(value, 8, 5000),
  ), "REVIEWED_BUYER_TERMS_REQUIRED");
  keys(packet.mapping, [
    "id",
    "sellerId",
    "ownerUserId",
    "connectedAccount",
    "decision",
  ]);
  require([
    packet.mapping.id,
    packet.mapping.sellerId,
    packet.mapping.ownerUserId,
  ].every(uuid) &&
    accountId(packet.mapping.connectedAccount) &&
    packet.mapping.connectedAccount !==
      target.stripePlatformAccount, "INVALID_SELLER_MAPPING");
  keys(packet.listing, ["id", "publicationRevision", "decision"]);
  require(uuid(packet.listing.id) &&
    Number.isSafeInteger(packet.listing.publicationRevision) &&
    packet.listing.publicationRevision > 1 &&
    packet.listing.publicationRevision <
      2147483647, "INVALID_PUBLICATION_REVISION");
  for (const value of [
    packet.policy.decision,
    packet.mapping.decision,
    packet.listing.decision,
  ])
    decision(value);
  return packet;
}
function decode(bytes, hash, max) {
  require(bytes.length <= max &&
    /^[a-f0-9]{64}$/.test(hash) &&
    paymentMaintenanceHash(bytes) === hash, "INPUT_HASH_MISMATCH");
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new PaymentMaintenanceError("INVALID_JSON");
  }
}
export function parsePaymentReview(bytes, hash) {
  return { packet: validatePaymentReview(decode(bytes, hash, 65536)), hash };
}
export const parsePaymentPlan = (bytes, hash) => decode(bytes, hash, 262144);

/** Only these two literal constants from the fixed application owner enter SQL.
 * No eval, interpolation, caller SQL, or server-only module bypass. Shape drift denies. */
export function paymentEligibilitySource() {
  const bytes = readFileSync(
    new URL(
      "../src/features/catalog/publication-eligibility.server.ts",
      import.meta.url,
    ),
  );
  const source = bytes.toString("utf8");
  const read = (name) => {
    const match = source.match(
      new RegExp("export const " + name + " = `([^`]+)`;", "g"),
    );
    require(match?.length === 1, "ELIGIBILITY_SOURCE_SHAPE_CHANGED");
    const value = match[0].slice(("export const " + name + " = `").length, -2);
    require(!value.includes("${") &&
      !value.includes("\\"), "ELIGIBILITY_SOURCE_SHAPE_CHANGED");
    return value;
  };
  return {
    sha256: paymentMaintenanceHash(bytes),
    joins: read("publishedJoins"),
    predicate: read("publishedEligibility"),
  };
}
const reference = (review, part) =>
  `${review.packet[part].decision.reference} [packet-sha256:${review.hash}]`;
export function paymentProposals(review) {
  const { target, policy, mapping, listing } = review.packet;
  return {
    policy: {
      id: policy.id,
      platform_account: target.stripePlatformAccount,
      livemode: false,
      environment: target.environment,
      application_id: target.stripeApplicationId,
      currency: "EUR",
      fee_bps: policy.feeBps,
      fee_fixed_minor: policy.feeFixedMinor,
      tax_policy: "inclusive",
      handover: "pickup",
      settlement_merchant: policy.settlementMerchant,
      refund_policy: "full_fee_and_transfer_reversal",
      buyer_terms: policy.buyerTerms,
      approval_reference: reference(review, "policy"),
    },
    mapping: {
      id: mapping.id,
      seller_id: mapping.sellerId,
      platform_account: target.stripePlatformAccount,
      livemode: false,
      connected_account: mapping.connectedAccount,
      approval_reference: reference(review, "mapping"),
    },
    listing: {
      seller_id: mapping.sellerId,
      listing_id: listing.id,
      publication_revision: listing.publicationRevision,
      policy_id: policy.id,
      approval_reference: reference(review, "listing"),
    },
  };
}
export async function assertPaymentMaintenanceAuthority(client, target) {
  const row = (
    await client.query(
      `SELECT current_database() AS database,current_user AS role,session_user AS login,
    NOT EXISTS(SELECT 1 FROM (VALUES ('treido.payment_policies'),('treido.seller_payment_bindings'),('treido.payable_listing_terms')) AS tables(name) WHERE NOT has_table_privilege(current_user,name,'INSERT')) AS can_insert,
    EXISTS(SELECT 1 FROM pg_roles WHERE rolname=$1 AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls) AS runtime_restricted,
    EXISTS(SELECT 1 FROM pg_roles r CROSS JOIN (VALUES ('treido.payment_policies'),('treido.seller_payment_bindings'),('treido.payable_listing_terms')) AS tables(name) WHERE (r.rolname=$1 OR pg_has_role($1,r.oid,'MEMBER')) AND (has_table_privilege(r.oid,name,'INSERT,UPDATE,DELETE,TRUNCATE') OR has_any_column_privilege(r.oid,name,'INSERT,UPDATE'))) AS runtime_write,
    EXISTS(SELECT 1 FROM pg_roles r WHERE (r.rolname=$1 OR pg_has_role($1,r.oid,'MEMBER')) AND (r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls OR r.rolname=current_user OR has_database_privilege(r.oid,current_database(),'CREATE') OR has_schema_privilege(r.oid,'public','CREATE') OR has_schema_privilege(r.oid,'treido','CREATE'))) AS runtime_admin`,
      [target.runtimeRole],
    )
  ).rows[0];
  require(row &&
    row.database === target.database &&
    row.role === target.maintenanceRole &&
    row.login === target.maintenanceRole &&
    row.can_insert &&
    row.runtime_restricted &&
    !row.runtime_write &&
    !row.runtime_admin, "MAINTENANCE_AUTHORITY_DENIED");
}
function capabilities(account) {
  const requirement = account.requirements;
  const fields = (values) => {
    require(values == null ||
      (Array.isArray(values) &&
        values.length <= 100 &&
        values.every(
          (value) => typeof value === "string" && value.length <= 200,
        )), "PROVIDER_FACTS_INVALID");
    return [...(values ?? [])].sort();
  };
  return {
    chargesEnabled: account.charges_enabled === true,
    payoutsEnabled: account.payouts_enabled === true,
    detailsSubmitted: account.details_submitted === true,
    cardPayments: account.capabilities?.card_payments ?? "unrequested",
    transfers: account.capabilities?.transfers ?? "unrequested",
    currentlyDue: fields(requirement?.currently_due),
    pastDue: fields(requirement?.past_due),
    pendingVerification: fields(requirement?.pending_verification),
    disabledReason: requirement?.disabled_reason ?? null,
  };
}
/** Read existing accounts through the intended platform's TEST client only. */
export async function readPaymentProviderFacts(stripe, review) {
  const platform = await stripe.accounts.retrieve(null);
  require(platform.id === review.packet.target.stripePlatformAccount &&
    platform.country === "BG" &&
    platform.default_currency === "eur", "STRIPE_PLATFORM_MISMATCH");
  const account = await stripe.accounts.retrieve(
    review.packet.mapping.connectedAccount,
  );
  require(account.id === review.packet.mapping.connectedAccount &&
    account.country === "BG" &&
    account.default_currency === "eur" &&
    account.type === "express" &&
    account.controller?.is_controller === true &&
    account.controller?.stripe_dashboard?.type === "express" &&
    account.controller?.requirement_collection ===
      "stripe", "EXISTING_EXPRESS_MAPPING_REQUIRED");
  return {
    mode: "test",
    platform: {
      id: platform.id,
      country: platform.country,
      currency: platform.default_currency,
      ...capabilities(platform),
    },
    connected: {
      id: account.id,
      country: account.country,
      currency: account.default_currency,
      type: account.type,
      controller: {
        isController: true,
        dashboard: "express",
        requirementCollection: "stripe",
        feesPayer: account.controller.fees?.payer ?? null,
        paymentsLosses: account.controller.losses?.payments ?? null,
      },
      ...capabilities(account),
    },
  };
}
async function resources(client, review, source) {
  const { mapping, listing } = review.packet;
  const row = (
    await client.query(
      `SELECT to_jsonb(s) AS seller,to_jsonb(l) AS listing,to_jsonb(p) AS publication,to_jsonb(c) AS category,
    (SELECT jsonb_agg(jsonb_build_object('assetId',a.id,'state',a.state,'revision',a.revision,'checksum',a.derivative_checksum,'width',a.width,'height',a.height,'accepted',to_jsonb(pm)) ORDER BY pm.position) FROM treido.listing_publication_media pm JOIN treido.media_assets a ON a.id=pm.asset_id WHERE pm.seller_id=l.seller_id AND pm.listing_id=l.id AND pm.publication_revision=p.revision) AS media,
    (SELECT jsonb_build_object('id',d.id,'revision',d.revision,'requirement_version',d.requirement_version,'country',d.country,'status',d.status) FROM treido.seller_declarations d WHERE d.seller_id=s.id AND d.revision=p.declaration_revision) AS declaration
    ${source.joins} WHERE l.seller_id=$1 AND l.id=$2 AND p.revision=$3 AND p.terms->'handover' ? 'pickup' AND ${source.predicate}`,
      [mapping.sellerId, listing.id, listing.publicationRevision],
    )
  ).rows[0];
  require(row, "CURRENT_PICKUP_PUBLICATION_REQUIRED");
  const owner = (
    await client.query(
      `SELECT u.id,u.status,coalesce(m.revision,0) AS membership_revision FROM treido.users u
    LEFT JOIN treido.personal_seller_owners o ON o.user_id=u.id AND o.seller_id=$1
    LEFT JOIN treido.seller_memberships m ON m.user_id=u.id AND m.seller_id=$1 AND m.status='active' AND m.role='owner'
    WHERE u.id=$2 AND u.status='active' AND (o.seller_id IS NOT NULL OR m.seller_id IS NOT NULL)`,
      [mapping.sellerId, mapping.ownerUserId],
    )
  ).rows[0];
  require(owner, "CURRENT_SELLER_OWNER_REQUIRED");
  return { ...row, owner };
}
async function registries(client, review) {
  const { target, policy, mapping, listing } = review.packet;
  const read = async (sql, values) =>
    (await client.query(sql, values)).rows.map((row) => row.value);
  return {
    policy: await read(
      "SELECT to_jsonb(p) AS value FROM treido.payment_policies p WHERE id=$1 ORDER BY id",
      [policy.id],
    ),
    mapping: await read(
      "SELECT to_jsonb(b) AS value FROM treido.seller_payment_bindings b WHERE id=$1 OR (platform_account=$2 AND livemode=false AND (seller_id=$3 OR connected_account=$4)) ORDER BY id",
      [
        mapping.id,
        target.stripePlatformAccount,
        mapping.sellerId,
        mapping.connectedAccount,
      ],
    ),
    listing: await read(
      "SELECT to_jsonb(t) AS value FROM treido.payable_listing_terms t WHERE seller_id=$1 AND listing_id=$2 AND publication_revision=$3 ORDER BY policy_id",
      [mapping.sellerId, listing.id, listing.publicationRevision],
    ),
  };
}
function validateReview(review) {
  validatePaymentReview(review.packet);
  require(/^[a-f0-9]{64}$/.test(review.hash), "INPUT_HASH_MISMATCH");
}
export async function createPaymentMaintenancePlan(client, review, stripe) {
  validateReview(review);
  const source = paymentEligibilitySource();
  const provider = await readPaymentProviderFacts(stripe, review);
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await assertPaymentMaintenanceAuthority(client, review.packet.target);
    const preimages = await registries(client, review);
    require(Object.values(preimages).every(
      (rows) => rows.length === 0,
    ), "EXISTING_REGISTRY_REPLAY_OR_REVIEW_REQUIRED");
    const plan = {
      format: "treido-test-payment-plan-v1",
      target: review.packet.target,
      reviewPacketSha256: review.hash,
      eligibilitySourceSha256: source.sha256,
      provider,
      resources: await resources(client, review, source),
      preimages,
      proposals: paymentProposals(review),
    };
    await client.query("COMMIT");
    return plan;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
const limits = {
  collectionChanged: false,
  webhookQualified: false,
  providerReadinessQualified: false,
  aftercareQualified: false,
  genuineSessionQualified: false,
};
const providerIdentity = (facts) => ({
  mode: facts.mode,
  platform: {
    id: facts.platform.id,
    country: facts.platform.country,
    currency: facts.platform.currency,
  },
  connected: {
    id: facts.connected.id,
    country: facts.connected.country,
    currency: facts.connected.currency,
    type: facts.connected.type,
    controller: facts.connected.controller,
  },
});
export async function applyPaymentMaintenancePlan(
  client,
  plan,
  review,
  stripe,
) {
  validateReview(review);
  keys(plan, [
    "format",
    "target",
    "reviewPacketSha256",
    "eligibilitySourceSha256",
    "provider",
    "resources",
    "preimages",
    "proposals",
  ]);
  const source = paymentEligibilitySource();
  require(plan.format === "treido-test-payment-plan-v1" &&
    equal(plan.target, review.packet.target) &&
    plan.reviewPacketSha256 === review.hash &&
    plan.eligibilitySourceSha256 === source.sha256 &&
    equal(plan.proposals, paymentProposals(review)) &&
    object(plan.preimages) &&
    equal(plan.preimages, {
      policy: [],
      mapping: [],
      listing: [],
    }), "PLAN_REVIEW_MISMATCH");
  // Capabilities/requirements are observations, not registry authority. They may
  // improve during real onboarding; runtime rechecks readiness for every quote.
  const provider = await readPaymentProviderFacts(stripe, review);
  require(equal(
    providerIdentity(provider),
    providerIdentity(plan.provider),
  ), "PROVIDER_PREIMAGE_MISMATCH");
  await client.query("BEGIN");
  try {
    await assertPaymentMaintenanceAuthority(client, review.packet.target);
    // Fixed locks prevent both updates and new latest-category/declaration/media
    // rows while the accepted source snapshot is compared and registries append.
    await client.query(
      "LOCK TABLE treido.users,treido.seller_accounts,treido.personal_seller_owners,treido.seller_memberships,treido.listings,treido.listing_publications,treido.category_policies,treido.seller_declarations,treido.media_assets,treido.listing_publication_media IN SHARE MODE",
    );
    await client.query(
      "LOCK TABLE treido.payment_policies,treido.seller_payment_bindings,treido.payable_listing_terms IN SHARE ROW EXCLUSIVE MODE",
    );
    require(equal(
      await resources(client, review, source),
      plan.resources,
    ), "RESOURCE_PREIMAGE_MISMATCH");
    const current = await registries(client, review);
    const replay = Object.keys(plan.proposals).every(
      (name) =>
        current[name].length === 1 &&
        current[name][0].approved_at &&
        current[name][0].revoked_at === null &&
        equal(
          Object.fromEntries(
            Object.keys(plan.proposals[name]).map((key) => [
              key,
              current[name][0][key],
            ]),
          ),
          plan.proposals[name],
        ),
    );
    if (replay) {
      const active = (
        await client.query(
          "SELECT (SELECT approved_at<=clock_timestamp() FROM treido.payment_policies WHERE id=$1) AND (SELECT approved_at<=clock_timestamp() FROM treido.seller_payment_bindings WHERE id=$2) AND (SELECT approved_at<=clock_timestamp() FROM treido.payable_listing_terms WHERE seller_id=$3 AND listing_id=$4 AND publication_revision=$5 AND policy_id=$1) AS active",
          [
            review.packet.policy.id,
            review.packet.mapping.id,
            review.packet.mapping.sellerId,
            review.packet.listing.id,
            review.packet.listing.publicationRevision,
          ],
        )
      ).rows[0]?.active;
      require(active, "REGISTRY_PREIMAGE_MISMATCH");
      await client.query("COMMIT");
      return {
        status: "already-applied",
        reviewPacketSha256: review.hash,
        records: current,
        provider,
        ...limits,
      };
    }
    require(equal(current, plan.preimages), "REGISTRY_PREIMAGE_MISMATCH");
    const applied = {};
    for (const [name, table] of [
      ["policy", "payment_policies"],
      ["mapping", "seller_payment_bindings"],
      ["listing", "payable_listing_terms"],
    ]) {
      const row = plan.proposals[name],
        columns = Object.keys(row);
      // Names come exclusively from paymentProposals and this fixed table list.
      const result = await client.query(
        `INSERT INTO treido.${table}(${columns.join(",")},approved_at) VALUES(${columns.map((_key, index) => "$" + (index + 1)).join(",")},clock_timestamp()) RETURNING to_jsonb(${table}) AS value`,
        Object.values(row).map((value) =>
          object(value) ? JSON.stringify(value) : value,
        ),
      );
      applied[name] = [result.rows[0].value];
    }
    await client.query("COMMIT");
    return {
      status: "applied",
      reviewPacketSha256: review.hash,
      records: applied,
      provider,
      ...limits,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
