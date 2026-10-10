import { readFile, stat } from "node:fs/promises";
import { pathToFileURL, URL } from "node:url";
import process from "node:process";
import { Client } from "pg";
import Stripe from "stripe";
import {
  maintenanceArguments,
  qualifiedMaintenanceConnection,
} from "./category-policy-maintenance.mjs";
import {
  PaymentMaintenanceError,
  parsePaymentReview,
  parsePaymentPlan,
  createPaymentMaintenancePlan,
  applyPaymentMaintenancePlan,
} from "./payment-registry-maintenance-core.mjs";

export const paymentMaintenanceHelp = `Reviewed TEST payment registry setup (Node 24.20.0; run from app/)

  node apps/web/scripts/payment-registry-maintenance.mjs --plan review.json --review-sha256 <lowercase SHA256> --branch <exact Neon branch ID>
  node apps/web/scripts/payment-registry-maintenance.mjs --apply plan.json --plan-sha256 <lowercase SHA256> --review review.json --review-sha256 <lowercase SHA256> --branch <exact Neon branch ID>
  node apps/web/scripts/payment-registry-maintenance.mjs --help

This first scope registers ONE existing active seller, ONE existing current public
pickup publication, and ONE existing BG/EUR Express account in Stripe TEST mode.
Development/test/Preview only; Production/live mode is rejected. No provider
objects, accounts, account links, charges, transfers or payouts are created.
Existing different/revoked records are never updated, deleted or remapped.

Provide protected process bindings already qualified for the intended target:
TREIDO_ENV, TREIDO_DATA_MODE=database, TREIDO_NEON_PROJECT_ID,
TREIDO_NEON_BRANCH_ID, TREIDO_NEON_BRANCH_PURPOSE, TREIDO_DB_REGION,
TREIDO_DB_DATABASE, TREIDO_DB_ROLE, DATABASE_URL and direct MIGRATION_DATABASE_URL.
The existing Development bridge is supported. Also require TREIDO_APP_ORIGIN,
TREIDO_STRIPE_MODE=test, TREIDO_STRIPE_APPLICATION_ID,
TREIDO_STRIPE_PLATFORM_ACCOUNT and the intended STRIPE_SECRET_KEY (sk_test or
restricted rk_test with account read permission). No environment files are loaded
by this command; no secret or connection value is printed. TLS peer verification
is mandatory. Existing maintainer login and privileges must already be authorized.

Review JSON has EXACT fields (names below describe required inputs, not approvals):
{format:"treido-test-payment-review-v1", target:{application:"treido-eu",
environment:"development|test|preview", projectId,branchId,database,region,
runtimeRole,maintenanceRole,country:"BG",appOrigin,stripeApplicationId,
stripePlatformAccount,livemode:false}, authorizationReference,
policy:{id:<new UUID>,feeBps,feeFixedMinor,settlementMerchant:"platform|seller",
buyerTerms:{bg,en},decision:{reference,reviewedBy,reviewedAt}},
mapping:{id:<new UUID>,sellerId,ownerUserId,connectedAccount,
decision:{reference,reviewedBy,reviewedAt}},
listing:{id,publicationRevision,decision:{reference,reviewedBy,reviewedAt}}}
reviewedAt is a UTC ISO timestamp with milliseconds. The three decisions record
actual separate fee/buyer-terms review, seller/account mapping authorization,
and acceptance of the exact publication revision under that policy. The operator
must qualify actual database/project/branch and account/seller ownership first.
The command cannot authenticate attestations or manufacture approval. It applies
only explicit EUR/inclusive-tax/pickup/full-fee-and-transfer-reversal terms; no fee,
settlement role, buyer text, owner identity or review reference is defaulted.

Workflow: retain the actual review packet and hash its exact bytes:
  (Get-FileHash -Algorithm SHA256 -LiteralPath review.json).Hash.ToLowerInvariant()
Generate a read-only plan; retain stdout as plan.json. Inspect exact target,
current owner/seller/publication/category/media and empty registry preimages,
read-only Stripe identity/controller facts, and all three proposed rows. Hash the
exact plan bytes and authorize that concrete plan before applying with the same
review packet. Apply refreshes provider identity before database locks, compares
all current preimages under fixed locks, then INSERTs all three records atomically.
Identical original replay returns the existing records. Stale public facts,
namespace, controller, owner, review or registry aborts the whole packet. Mutable
Stripe capability/requirement observations may change; checkout rechecks them.
The maintenance role needs SELECT/INSERT on the three payment registries and the
privileges for SHARE ROW EXCLUSIVE locks there, plus SHARE locks on the fixed
publication/owner/category/declaration/media tables. Runtime table/column writes,
TRUNCATE and inherited maintenance/schema-creation authority are denied. No grants
are issued. Retain review, plan and receipt; this initial setup cannot replace an
existing policy/mapping or attach a later publication using a different packet.

Registry setup does not enable collection, establish genuine Clerk identity,
approve category/item ownership, qualify Stripe readiness, webhook signatures,
signed jobs, aftercare/return policies, or prove a purchase/fulfilment occurred.
Complete the existing onboarding, reviewed financial/aftercare terms, exact
webhook namespace/events and current runtime readiness checks separately.
`;
export const paymentMaintenanceArguments = maintenanceArguments;
const fail = (code) => {
  throw new PaymentMaintenanceError(code);
};
export function qualifiedPaymentConnection(env, target, branch) {
  if (
    !["development", "test", "preview"].includes(target.environment) ||
    target.livemode !== false ||
    env.TREIDO_STRIPE_MODE !== "test" ||
    env.TREIDO_STRIPE_PLATFORM_ACCOUNT !== target.stripePlatformAccount ||
    env.TREIDO_STRIPE_APPLICATION_ID !== target.stripeApplicationId ||
    env.TREIDO_APP_ORIGIN !== target.appOrigin ||
    !/^(sk|rk)_test_[A-Za-z0-9]+$/.test(env.STRIPE_SECRET_KEY ?? "") ||
    Object.keys(env).some(
      (key) =>
        /^NEXT_PUBLIC_.*(?:STRIPE.*SECRET|STRIPE.*PRIVATE|STRIPE.*ACCESS)/.test(
          key,
        ) && env[key],
    )
  )
    fail("PROTECTED_TEST_STRIPE_NAMESPACE_REQUIRED");
  const connection = new URL(
    qualifiedMaintenanceConnection(env, target, branch),
  );
  connection.searchParams.set("sslmode", "verify-full");
  return connection.href;
}
async function boundedFile(path, max) {
  const info = await stat(path);
  if (!info.isFile() || info.size > max)
    fail("INPUT_FILE_TOO_LARGE_OR_INVALID");
  return readFile(path);
}
export async function runPaymentMaintenance(args, env) {
  const options = paymentMaintenanceArguments(args);
  if (options.mode === "help") return paymentMaintenanceHelp;
  if (process.version !== "v24.20.0") fail("PINNED_NODE_24_20_0_REQUIRED");
  const review = parsePaymentReview(
    await boundedFile(options.reviewFile, 65536),
    options.reviewHash,
  );
  const plan =
    options.mode === "apply"
      ? parsePaymentPlan(
          await boundedFile(options.planFile, 262144),
          options.planHash,
        )
      : null;
  const client = new Client({
    connectionString: qualifiedPaymentConnection(
      env,
      review.packet.target,
      options.branch,
    ),
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
    lock_timeout: 5000,
    application_name: "treido-test-payment-maintenance",
  });
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    host: "api.stripe.com",
    protocol: "https",
    port: 443,
    maxNetworkRetries: 0,
    timeout: 15000,
    telemetry: false,
  });
  try {
    await client.connect();
    if (
      !client.connection?.stream?.encrypted ||
      !client.connection.stream.authorized
    )
      fail("DATABASE_PEER_TLS_REQUIRED");
    return (
      JSON.stringify(
        options.mode === "plan"
          ? await createPaymentMaintenancePlan(client, review, stripe)
          : await applyPaymentMaintenancePlan(client, plan, review, stripe),
        null,
        2,
      ) + "\n"
    );
  } finally {
    await client.end();
  }
}
if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    process.stdout.write(
      await runPaymentMaintenance(process.argv.slice(2), process.env),
    );
  } catch (error) {
    process.stderr.write(
      JSON.stringify({
        status: "denied",
        code:
          error instanceof PaymentMaintenanceError
            ? error.message
            : "MAINTENANCE_UNAVAILABLE",
        secretsPrinted: false,
      }) + "\n",
    );
    process.exitCode = 1;
  }
}
