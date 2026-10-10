import { createHash } from "node:crypto";
import { sourcePolicies } from "./category-activation-dry-run.mjs";

const seed = sourcePolicies();
const registryHash =
  "c55a24a0fa4a7a6e625f1945d1135c028a507bae1c22113bfb6234e2d8b4b142";
const supported = new Set(["cat:books-media/fiction"]);
const object = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
export class CategoryMaintenanceError extends Error {
  constructor(code) {
    super(code);
    this.name = "CategoryMaintenanceError";
  }
}
const require = (condition, code) => {
  if (!condition) throw new CategoryMaintenanceError(code);
};
function keys(value, names) {
  require(object(value) &&
    Object.keys(value).length === names.length &&
    names.every((name) => Object.hasOwn(value, name)), "INVALID_PACKET_FIELDS");
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
export const maintenanceHash = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
const equal = (left, right) => canonical(left) === canonical(right);
function text(value, max = 300) {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length >= 8 &&
    value.length <= max &&
    ![...value].some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    ) &&
    !/(?:placeholder|todo|unapproved|synthetic|fixture|example)/i.test(value)
  );
}
function decode(bytes, expectedHash, max) {
  require(bytes.length <= max &&
    /^[a-f0-9]{64}$/.test(expectedHash) &&
    maintenanceHash(bytes) === expectedHash, "INPUT_HASH_MISMATCH");
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new CategoryMaintenanceError("INVALID_JSON");
  }
}
export function validateReviewPacket(packet) {
  keys(packet, [
    "format",
    "target",
    "authorizationReference",
    "decision",
    "policies",
  ]);
  require(packet.format === "treido-category-review-v1" &&
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
  ]);
  const target = packet.target;
  require(target.application === "treido-eu" &&
    ["development", "test", "preview", "production"].includes(
      target.environment,
    ) &&
    target.country === "BG" &&
    /^[a-z][a-z0-9-]{2,100}$/.test(target.projectId) &&
    /^br-[a-z0-9-]{3,100}$/.test(target.branchId) &&
    /^[a-z0-9-]{3,80}$/.test(target.region) &&
    /^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(target.database) &&
    [target.runtimeRole, target.maintenanceRole].every((role) =>
      /^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(role),
    ) &&
    target.runtimeRole !== target.maintenanceRole, "INVALID_TARGET");
  keys(packet.decision, [
    "reference",
    "reviewedBy",
    "reviewedAt",
    "goodsScope",
  ]);
  require(text(packet.decision.reference) &&
    text(packet.decision.reviewedBy, 120) &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(
      packet.decision.reviewedAt,
    ) &&
    Number.isFinite(Date.parse(packet.decision.reviewedAt)) &&
    Date.parse(packet.decision.reviewedAt) <= Date.now() &&
    packet.decision.goodsScope ===
      "ordinary-physical-nonregulated", "ACTUAL_REVIEW_DECISION_REQUIRED");
  require(new Date(packet.decision.reviewedAt).toISOString() ===
    packet.decision.reviewedAt, "ACTUAL_REVIEW_DECISION_REQUIRED");
  require(Array.isArray(packet.policies) &&
    packet.policies.length >= 1 &&
    packet.policies.length <= 12, "INVALID_LEAF_COUNT");
  const seen = new Set();
  for (const policy of packet.policies) {
    keys(policy, [
      "categoryId",
      "sellerKinds",
      "conditions",
      "handoverModes",
      "purchaseModes",
    ]);
    const source = seed.rows.find(
      (row) => row.categoryId === policy.categoryId,
    );
    require(source &&
      supported.has(policy.categoryId) &&
      !seen.has(policy.categoryId), "UNSUPPORTED_OR_DUPLICATE_LEAF");
    seen.add(policy.categoryId);
    for (const [name, allowed] of [
      ["sellerKinds", source.rules.sellerKinds],
      ["conditions", source.rules.conditions],
      ["handoverModes", ["pickup"]],
      ["purchaseModes", ["contact"]],
    ])
      require(Array.isArray(policy[name]) &&
        policy[name].length > 0 &&
        new Set(policy[name]).size === policy[name].length &&
        policy[name].every((value) =>
          allowed.includes(value),
        ), "UNSUPPORTED_POLICY_SELECTION");
  }
  return packet;
}
export function parseReviewedPacket(bytes, expectedHash) {
  return {
    packet: validateReviewPacket(decode(bytes, expectedHash, 65536)),
    hash: expectedHash,
  };
}
export function parseMaintenancePlan(bytes, expectedHash) {
  return decode(bytes, expectedHash, 262144);
}
function reviewReference(review) {
  return `${review.packet.decision.reference} [packet-sha256:${review.hash}]`;
}
function proposal(policy, previous, review) {
  const source = seed.rows.find((row) => row.categoryId === policy.categoryId);
  require(previous &&
    previous.registry_version === 1 &&
    previous.category_id === policy.categoryId &&
    previous.category_kind === "leaf" &&
    previous.country === "BG" &&
    Number.isSafeInteger(previous.version) &&
    previous.version >= 1 &&
    previous.version < 2147483647 &&
    object(previous.rules) &&
    Array.isArray(previous.rules.restrictions) &&
    previous.rules.restrictions.every((rule) => typeof rule === "string") &&
    source.rules.restrictions.every((rule) =>
      previous.rules.restrictions.includes(rule),
    ), "INVALID_POLICY_PREIMAGE");
  return {
    registry_version: 1,
    category_id: policy.categoryId,
    category_kind: "leaf",
    country: "BG",
    version: previous.version + 1,
    state: "reviewed",
    enabled_for_publish: true,
    rules: {
      ...previous.rules,
      sellerKinds: [...policy.sellerKinds].sort(),
      conditions: [...policy.conditions].sort(),
      countries: ["BG"],
      handoverModes: ["pickup"],
      purchaseModes: ["contact"],
    },
    review_reference: reviewReference(review),
  };
}
export async function assertMaintenanceAuthority(client, target) {
  const row = (
    await client.query(
      `SELECT current_database() AS database,current_user AS role,session_user AS login,
    has_table_privilege(current_user,'treido.category_policies','INSERT') AS can_insert,
    EXISTS(SELECT 1 FROM pg_roles WHERE rolname=$1 AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication) AS runtime_restricted,
    EXISTS(SELECT 1 FROM (VALUES ('treido.category_registry_versions'),('treido.categories'),('treido.category_policies')) AS tables(name)
      WHERE has_table_privilege($1,name,'INSERT,UPDATE,DELETE,TRUNCATE') OR has_any_column_privilege($1,name,'INSERT,UPDATE')) AS runtime_write,
    (pg_has_role($1,current_user,'MEMBER') OR has_database_privilege($1,current_database(),'CREATE') OR has_schema_privilege($1,'public','CREATE') OR has_schema_privilege($1,'treido','CREATE')) AS runtime_admin`,
      [target.runtimeRole],
    )
  ).rows[0];
  require(row &&
    row.database === target.database &&
    row.role === target.maintenanceRole &&
    row.login === target.maintenanceRole &&
    row.role !== target.runtimeRole &&
    row.can_insert &&
    row.runtime_restricted &&
    !row.runtime_write &&
    !row.runtime_admin, "MAINTENANCE_AUTHORITY_DENIED");
}
async function registry(client) {
  const row = (
    await client.query(
      "SELECT to_jsonb(r) AS value FROM treido.category_registry_versions r ORDER BY version DESC LIMIT 1",
    )
  ).rows[0]?.value;
  require(row &&
    row.version === 1 &&
    row.content_hash === registryHash, "REGISTRY_PREIMAGE_MISMATCH");
  return row;
}
async function categories(client, ids) {
  const rows = (
    await client.query(
      "SELECT to_jsonb(c) AS value FROM treido.categories c WHERE registry_version=1 AND id=ANY($1::text[]) ORDER BY id",
      [ids],
    )
  ).rows.map((row) => row.value);
  require(rows.length === ids.length &&
    rows.every(
      (row, index) => row.id === ids[index] && row.kind === "leaf",
    ), "CATEGORY_PREIMAGE_MISMATCH");
  return rows;
}
async function latest(client, ids) {
  return (
    await client.query(
      `SELECT to_jsonb(p) AS value FROM treido.category_policies p WHERE registry_version=1 AND country='BG' AND category_id=ANY($1::text[])
    AND version=(SELECT max(version) FROM treido.category_policies n WHERE n.registry_version=p.registry_version AND n.category_id=p.category_id AND n.country=p.country) ORDER BY category_id`,
      [ids],
    )
  ).rows.map((row) => row.value);
}
function validateReview(review) {
  validateReviewPacket(review.packet);
  require(/^[a-f0-9]{64}$/.test(review.hash), "INPUT_HASH_MISMATCH");
}
export async function createMaintenancePlan(client, review) {
  validateReview(review);
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await assertMaintenanceAuthority(client, review.packet.target);
    const policies = [...review.packet.policies].sort((a, b) =>
      a.categoryId.localeCompare(b.categoryId),
    );
    const preimages = await latest(
      client,
      policies.map((policy) => policy.categoryId),
    );
    require(preimages.length === policies.length, "POLICY_PREIMAGE_MISSING");
    const previous = await client.query(
      "SELECT 1 FROM treido.category_policies WHERE registry_version=1 AND country='BG' AND category_id=ANY($1::text[]) AND review_reference=$2 LIMIT 1",
      [policies.map((p) => p.categoryId), reviewReference(review)],
    );
    require(previous.rowCount ===
      0, "REVIEW_ALREADY_RECORDED_REPLAY_ORIGINAL_PLAN");
    const plan = {
      format: "treido-category-plan-v1",
      target: review.packet.target,
      reviewPacketSha256: review.hash,
      sourceMigrationSha256: seed.sourceSha256,
      registry: await registry(client),
      categories: await categories(
        client,
        policies.map((policy) => policy.categoryId),
      ),
      preimages,
      proposals: policies.map((policy, index) =>
        proposal(policy, preimages[index], review),
      ),
    };
    await client.query("COMMIT");
    return plan;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
export async function applyMaintenancePlan(client, plan, review) {
  validateReview(review);
  keys(plan, [
    "format",
    "target",
    "reviewPacketSha256",
    "sourceMigrationSha256",
    "registry",
    "categories",
    "preimages",
    "proposals",
  ]);
  const policies = [...review.packet.policies].sort((a, b) =>
    a.categoryId.localeCompare(b.categoryId),
  );
  require(plan.format === "treido-category-plan-v1" &&
    equal(plan.target, review.packet.target) &&
    plan.reviewPacketSha256 === review.hash &&
    plan.sourceMigrationSha256 === seed.sourceSha256 &&
    Array.isArray(plan.preimages) &&
    plan.preimages.length === policies.length &&
    equal(
      plan.proposals,
      policies.map((policy, index) =>
        proposal(policy, plan.preimages[index], review),
      ),
    ), "PLAN_REVIEW_MISMATCH");
  await client.query("BEGIN");
  try {
    await assertMaintenanceAuthority(client, plan.target);
    // Fixed table names only. Exclude concurrent maintenance inserts, changes
    // and deletions throughout the preimage comparison and atomic append.
    await client.query(
      "LOCK TABLE treido.category_registry_versions,treido.categories,treido.category_policies IN SHARE ROW EXCLUSIVE MODE",
    );
    require(equal(
      await registry(client),
      plan.registry,
    ), "REGISTRY_PREIMAGE_MISMATCH");
    require(equal(
      await categories(
        client,
        policies.map((policy) => policy.categoryId),
      ),
      plan.categories,
    ), "CATEGORY_PREIMAGE_MISMATCH");
    const rows = await latest(
      client,
      policies.map((policy) => policy.categoryId),
    );
    const replay =
      rows.length === plan.proposals.length &&
      rows.every(
        (row, index) =>
          row.reviewed_at &&
          equal(
            Object.fromEntries(
              Object.keys(plan.proposals[index]).map((key) => [key, row[key]]),
            ),
            plan.proposals[index],
          ),
      );
    if (replay) {
      await client.query("COMMIT");
      return { status: "already-applied", policies: rows };
    }
    require(equal(rows, plan.preimages), "POLICY_PREIMAGE_MISMATCH");
    const recorded = await client.query(
      "SELECT 1 FROM treido.category_policies WHERE registry_version=1 AND country='BG' AND category_id=ANY($1::text[]) AND review_reference=$2 LIMIT 1",
      [policies.map((p) => p.categoryId), reviewReference(review)],
    );
    require(recorded.rowCount === 0, "REVIEW_ALREADY_RECORDED");
    const applied = [];
    for (const row of plan.proposals) {
      const result = await client.query(
        `INSERT INTO treido.category_policies(registry_version,category_id,category_kind,country,version,state,enabled_for_publish,rules,review_reference,reviewed_at)
        VALUES($1,$2,$3,$4,$5,'reviewed',true,$6::jsonb,$7,clock_timestamp()) RETURNING to_jsonb(category_policies) AS value`,
        [
          row.registry_version,
          row.category_id,
          row.category_kind,
          row.country,
          row.version,
          JSON.stringify(row.rules),
          row.review_reference,
        ],
      );
      applied.push(result.rows[0].value);
    }
    await client.query("COMMIT");
    return { status: "applied", policies: applied };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
