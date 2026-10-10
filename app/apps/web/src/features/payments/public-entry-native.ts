// Isolated native test adapter; never imported by an application route.
import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import type { SellerDatabase } from "../../server/db/database";
import type { PublishedListing } from "../catalog/published-model";
import { readPublicPaymentEntry } from "./public-entry.server";

type Fixture = { sellerId: string; draft: { id: string } };
type Entry = {
  read: (listing: PublishedListing) => Promise<boolean>;
  approve: (publicationRevision: number) => Promise<void>;
  revoke: () => Promise<void>;
};

/** Qualifies the real read gates with synthetic registry decisions. No provider
 * request is made; this is NOT Stripe readiness, live policy or payment proof. */
export async function withNativePaymentEntry(
  database: SellerDatabase, admin: Client, fixture: Fixture,
  run: (entry: Entry) => Promise<void>,
) {
  const target = (await admin.query<{ database: string; address: string }>(
    "SELECT current_database() AS database,host(inet_server_addr()) AS address",
  )).rows[0];
  if (target.database !== "treido_integration" || target.address !== "127.0.0.1")
    throw new Error("Payment entry fixture requires the isolated native cluster");
  const platform = "acct_NativeStockPlatform", policy = randomUUID();
  // These syntax-only values are intentionally fictional and never sent to a
  // provider. The SQL use case receives the isolated database explicitly.
  const environment: Record<string, string | undefined> = {
    TREIDO_ENV: "test", TREIDO_DATA_MODE: "database",
    TREIDO_APP_ORIGIN: "http://127.0.0.1:6500", TREIDO_APP_REGION: "eu-central-1",
    TREIDO_CLERK_APP_ID: "app_NativeStock", NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_NativeStock", CLERK_SECRET_KEY: "sk_test_NativeStock",
    TREIDO_NEON_PROJECT_ID: "isolated-native", TREIDO_NEON_BRANCH_ID: "br-isolated-native", TREIDO_NEON_BRANCH_PURPOSE: "test",
    TREIDO_DB_REGION: "eu-central-1", TREIDO_DB_DATABASE: "treido_integration", TREIDO_DB_ROLE: "treido_runtime",
    DATABASE_URL: "postgresql://treido_runtime:syntheticonly@ep-isolated.eu-central-1.aws.neon.tech/treido_integration?sslmode=require",
    TREIDO_DB_LOCAL_BRIDGE: undefined, TREIDO_DB_LOGIN_ROLE: undefined, VERCEL_ENV: undefined,
    TREIDO_STRIPE_MODE: "test", STRIPE_SECRET_KEY: "sk_test_NativeStock", STRIPE_PUBLISHABLE_KEY: "pk_test_NativeStock",
    TREIDO_STRIPE_PLATFORM_ACCOUNT: platform, TREIDO_STRIPE_APPLICATION_ID: "treido-native-stock", TREIDO_STRIPE_COLLECTION_ENABLED: "true",
    STRIPE_WEBHOOK_SECRET: "whsec_NativeStock", TREIDO_STRIPE_WEBHOOK_ENDPOINT_ID: "we_NativeStock", TREIDO_STRIPE_WEBHOOK_SCOPE: "platform",
    TREIDO_STRIPE_WEBHOOK_PLATFORM_ACCOUNT: platform, TREIDO_STRIPE_WEBHOOK_MODE: "test", TREIDO_STRIPE_WEBHOOK_ORIGIN: undefined,
  };
  const previous = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]));
  const set = (values: Record<string, string | undefined>) => {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  };
  set(environment);
  try {
    await run({
      read: listing => readPublicPaymentEntry(database, listing),
      approve: async revision => {
        await admin.query(
          "INSERT INTO treido.payment_policies(id,platform_account,livemode,environment,application_id,currency,fee_bps,fee_fixed_minor,tax_policy,handover,settlement_merchant,refund_policy,buyer_terms,approval_reference,approved_at) VALUES($1,$2,false,'test','treido-native-stock','EUR',0,0,'inclusive','pickup','platform','full_fee_and_transfer_reversal',$3::jsonb,'SYNTHETIC NATIVE ENTRY ONLY',clock_timestamp()-interval '1 second')",
          [policy, platform, JSON.stringify({ bg: "Само изолиран тест, без реално плащане.", en: "Isolated test only, no real payment." })],
        );
        await admin.query(
          "INSERT INTO treido.seller_payment_bindings(id,seller_id,platform_account,livemode,connected_account,approval_reference,approved_at) VALUES($1,$2,$3,false,$4,'SYNTHETIC NATIVE ENTRY ONLY',clock_timestamp()-interval '1 second')",
          [randomUUID(), fixture.sellerId, platform, "acct_Native" + randomUUID().replaceAll("-", "")],
        );
        await admin.query(
          "INSERT INTO treido.payable_listing_terms(seller_id,listing_id,publication_revision,policy_id,approval_reference,approved_at) VALUES($1,$2,$3,$4,'SYNTHETIC NATIVE ENTRY ONLY',clock_timestamp()-interval '1 second')",
          [fixture.sellerId, fixture.draft.id, revision, policy],
        );
      },
      revoke: async () => {
        await admin.query("UPDATE treido.payment_policies SET revoked_at=clock_timestamp() WHERE id=$1", [policy]);
      },
    });
  } finally { set(previous); }
}
