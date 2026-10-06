import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL, URL } from "node:url";
import process from "node:process";

// This tool has no database/provider client, environment loading or write mode.
export const activationTarget = Object.freeze({
  project: "still-hill-51924224",
  branch: "br-morning-waterfall-b1yn1mgv",
  database: "treido_global",
  application: "treido-eu",
  environment: "production",
  country: "BG",
});
const migrationUrl = new URL(
  "../migrations/0005_category_catalogue.sql",
  import.meta.url,
);
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
function exactKeys(value, keys, name) {
  if (
    !object(value) ||
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key))
  )
    throw new Error(`Invalid ${name} fields`);
}
export function sourcePolicies() {
  const sql = readFileSync(migrationUrl, "utf8");
  const section = sql.split("INSERT INTO treido.category_policies(")[1];
  const match = section?.match(
    /FROM jsonb_array_elements\('([^\n]+)'::jsonb\) item;/,
  );
  if (!match) throw new Error("Category seed unavailable");
  const rows = JSON.parse(match[1].replaceAll("''", "'"));
  if (
    rows.length !== 152 ||
    new Set(rows.map((r) => r.categoryId)).size !== rows.length ||
    rows.some(
      (r) =>
        r.country !== "BG" ||
        r.version !== 1 ||
        r.state !== "pending" ||
        r.enabled !== false,
    )
  )
    throw new Error("Unexpected source category seed");
  return { rows, sourceSha256: createHash("sha256").update(sql).digest("hex") };
}
function selection(value, allowed, name) {
  if (
    !Array.isArray(value) ||
    !value.length ||
    new Set(value).size !== value.length ||
    value.some((v) => typeof v !== "string" || !allowed.includes(v))
  )
    throw new Error(`Invalid ${name}`);
  return [...value].sort();
}
/** An owner review reference is an input attestation, never proof of review authenticity. */
export function dryRunCategoryActivation(packet) {
  exactKeys(packet, ["target", "reviewReference", "policies"], "packet");
  exactKeys(packet.target, Object.keys(activationTarget), "target");
  if (Object.entries(activationTarget).some(([k, v]) => packet.target[k] !== v))
    throw new Error("Foreign activation target");
  const reference = packet.reviewReference;
  if (
    typeof reference !== "string" ||
    reference.trim() !== reference ||
    reference.length < 8 ||
    reference.length > 500 ||
    /(?:synthetic|fixture|placeholder|todo|unapproved|example)/i.test(reference)
  )
    throw new Error("An actual owner review reference is required");
  if (
    !Array.isArray(packet.policies) ||
    !packet.policies.length ||
    packet.policies.length > 12
  )
    throw new Error("Select one to twelve reviewed pilot leaves");
  const source = sourcePolicies();
  const seen = new Set();
  const proposals = packet.policies.map((input) => {
    exactKeys(
      input,
      [
        "categoryId",
        "sellerKinds",
        "conditions",
        "handoverModes",
        "purchaseModes",
      ],
      "policy",
    );
    const seed = source.rows.find((r) => r.categoryId === input.categoryId);
    if (!seed || seen.has(input.categoryId))
      throw new Error("Unknown or duplicate category");
    seen.add(input.categoryId);
    const rules = JSON.parse(JSON.stringify(seed.rules));
    rules.sellerKinds = selection(
      input.sellerKinds,
      rules.sellerKinds,
      "seller kinds",
    );
    rules.conditions = selection(
      input.conditions,
      rules.conditions,
      "conditions",
    );
    // A deliberately bounded first activation; paid/shipping qualification is separate.
    rules.handoverModes = selection(
      input.handoverModes,
      ["pickup"],
      "handover modes",
    );
    rules.purchaseModes = selection(
      input.purchaseModes,
      ["contact"],
      "purchase modes",
    );
    return {
      registryVersion: 1,
      categoryId: seed.categoryId,
      country: "BG",
      expectedLatestVersion: 1,
      expectedLatestState: "pending",
      expectedLatestEnabled: false,
      expectedLatestRules: seed.rules,
      proposedVersion: 2,
      state: "reviewed",
      enabledForPublish: true,
      reviewReference: reference,
      rules,
    };
  });
  return {
    mode: "dry-run-only",
    databaseVerified: false,
    reviewAuthenticityVerified: false,
    target: activationTarget,
    sourceSha256: source.sourceSha256,
    applicationPreconditions: [
      "Verify intended Neon project/branch from protected binding",
      "Reauthorize approved maintenance actor; runtime role cannot write policies",
      "Lock policy registry in transaction and compare every latest row with expected version/state/enabled/rules",
      "Reject any existing version 2 or newer; re-review instead of overwriting",
      "Append reviewed version 2 with database review time; never mutate version 1",
      "Rollback on any mismatch; qualify real seller/media/publication and discovery separately",
    ],
    proposals,
  };
}
if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    const [mode, input, ...extra] = process.argv.slice(2);
    if (
      extra.length ||
      (mode !== "--catalogue" && mode !== "--packet") ||
      (mode === "--catalogue" && input) ||
      (mode === "--packet" && !input)
    )
      throw new Error(
        "Usage: category-activation-dry-run.mjs --catalogue | --packet owner-review.json",
      );
    const result =
      mode === "--catalogue"
        ? sourcePolicies()
        : dryRunCategoryActivation(JSON.parse(readFileSync(input, "utf8")));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
