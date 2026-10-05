// Foreground PostgreSQL single-user assertions: no listener, background server,
// application bindings, shared DB, provider requests or deleted recovery evidence.
import process from "node:process";
import console from "node:console";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { applySellerBillingGrants } from "../../apps/web/src/features/seller-billing/runtime-grants.mjs";
import { applyBillingRecoveryGrants } from "../../apps/web/src/features/seller-billing/recovery-runtime-grants.mjs";
const root = path.resolve(import.meta.dirname, "../../.."),
  evidence = path.join(root, ".qa/t72/billing");
if (process.version !== "v24.20.0") throw Error("Pinned Node required");
fs.mkdirSync(evidence, { recursive: true });
const directory = fs.mkdtempSync(path.join(evidence, "single-user-"));
const data = path.join(directory, "data");
if (
  path
    .relative(fs.realpathSync(evidence), fs.realpathSync(directory))
    .startsWith("..")
)
  throw Error("Unsafe fixture path");
const requireWeb = createRequire(path.join(root, "app/apps/web/package.json"));
const embedded = createRequire(requireWeb.resolve("embedded-postgres"));
const binaries = await import(
  pathToFileURL(
    embedded.resolve(
      "@embedded-postgres/" +
        (process.platform === "win32" ? "windows-x64" : "linux-x64"),
    ),
  ).href
);
const run = (exe, args, input, name) => {
  const out = fs.openSync(path.join(directory, name + ".out"), "w"),
    err = fs.openSync(path.join(directory, name + ".err"), "w");
  const emptyInput = path.join(directory, "empty-input");
  if (!input) fs.writeFileSync(emptyInput, "");
  const incoming = fs.openSync(input ?? emptyInput, "r");
  try {
    const result = spawnSync(exe, args, {
      stdio: [incoming, out, err],
      windowsHide: true,
      timeout: 60000,
    });
    if (result.error) throw result.error;
    return result.status;
  } finally {
    fs.closeSync(incoming);
    fs.closeSync(out);
    fs.closeSync(err);
  }
};
if (
  run(
    binaries.initdb,
    ["-D", data, "-A", "trust", "--no-locale", "-E", "UTF8"],
    null,
    "initdb",
  ) !== 0
)
  throw Error("Owned single-user initdb failed: " + directory);
let sql =
  fs.readFileSync(
    path.join(root, "app/apps/web/migrations/0001_identity_drafts.sql"),
    "utf8",
  ) +
  "\n" +
  fs.readFileSync(
    path.join(root, "app/apps/web/migrations/0003_durable_jobs.sql"),
    "utf8",
  ) +
  "\n" +
  fs.readFileSync(
    path.join(root, "app/apps/web/migrations/0031_seller_billing.sql"),
    "utf8",
  ) +
  "\n" +
  fs.readFileSync(
    path.join(root, "app/apps/web/migrations/0047_billing_change_recovery.sql"),
    "utf8",
  );
sql += `
CREATE ROLE t72_runtime; GRANT USAGE ON SCHEMA treido TO t72_runtime;
INSERT INTO treido.users(id,clerk_subject) VALUES('00000000-0000-4000-8000-000000000001','user_T72Synthetic');
INSERT INTO treido.seller_accounts(id,kind,name,created_by) VALUES('00000000-0000-4000-8000-000000000002','business','Synthetic only','00000000-0000-4000-8000-000000000001');
INSERT INTO treido.billing_catalogue(id,plan_id,version,seller_kind,platform_account,livemode,environment,application_id,product_id,price_id,amount_minor,currency,terms,limits,terms_version,tax_policy,change_configuration,portal_configuration,approved_at)
VALUES('00000000-0000-4000-8000-000000000003','business_pro',1,'business','acct_Synthetic',false,'test','t72-synthetic','prod_Synthetic','price_Synthetic',2499,'EUR','{"bg":"Test","en":"Test"}','{}','synthetic-v1','automatic','bpc_Synthetic','bpc_Synthetic',clock_timestamp());
INSERT INTO treido.billing_customers(id,seller_id,platform_account,livemode,environment,application_id,provider_id,approved_at)
VALUES('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000002','acct_Synthetic',false,'test','t72-synthetic','cus_Synthetic',clock_timestamp());
INSERT INTO treido.billing_intents(id,seller_id,actor_id,request_id,input_hash,operation,catalogue_id,customer_binding_id,expected_price_id,parameters,parameter_hash,idempotency_key,api_version,expires_at,state)
VALUES('00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000006',repeat('a',64),'checkout','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004','price_Synthetic','{}',repeat('b',64),'t72-synthetic-origin','2026-09-30.endive',clock_timestamp()+interval '1 hour','complete');
INSERT INTO treido.billing_intents(id,seller_id,actor_id,request_id,input_hash,operation,catalogue_id,customer_binding_id,subscription_id,preview_id,expected_price_id,parameters,parameter_hash,idempotency_key,api_version,created_at,expires_at,state,first_attempt_at)
VALUES('00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000008',repeat('a',64),'change','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004','sub_Synthetic','00000000-0000-4000-8000-000000000005','price_Synthetic','{}',repeat('b',64),'t72-synthetic-old','2026-09-30.endive',clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour','ready',clock_timestamp()-interval '2 hours');
DO $$ BEGIN
 BEGIN INSERT INTO treido.billing_intents SELECT '00000000-0000-4000-8000-000000000009',seller_id,actor_id,'00000000-0000-4000-8000-000000000010',input_hash,operation,catalogue_id,customer_binding_id,subscription_id,preview_id,expected_price_id,parameters,parameter_hash,'t72-synthetic-replacement',api_version,created_at,expires_at,state,provider_id,hosted_url,result,first_attempt_at,updated_at,revision,change_invoice_id FROM treido.billing_intents WHERE id='00000000-0000-4000-8000-000000000007'; RAISE EXCEPTION 'Expired browser deadline released pending uniqueness'; EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
`;
const grants = {
  query: async (text) => {
    sql += "\n" + text;
  },
};
await applySellerBillingGrants(grants, "t72_runtime");
await applyBillingRecoveryGrants(grants, "t72_runtime");
sql += `
SET ROLE t72_runtime;
UPDATE treido.billing_intents SET change_invoice_id='in_SyntheticOriginal' WHERE id='00000000-0000-4000-8000-000000000007';
DO $$ BEGIN
 IF (SELECT revision FROM treido.billing_intents WHERE id='00000000-0000-4000-8000-000000000007')<>1 THEN RAISE EXCEPTION 'Invoice evidence must increment revision'; END IF;
 BEGIN UPDATE treido.billing_intents SET parameters='{"new":true}' WHERE id='00000000-0000-4000-8000-000000000007'; RAISE EXCEPTION 'Runtime modified frozen parameters'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE treido.billing_intents SET change_invoice_id='in_SyntheticOther' WHERE id='00000000-0000-4000-8000-000000000007'; RAISE EXCEPTION 'Invoice replaced'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Immutable billing change invoice' THEN RAISE; END IF; END;
END $$;
INSERT INTO treido.billing_recovery_requests(id,intent_id,seller_id,actor_id,request_id,input_hash,operation,expected_revision,invoice_id,idempotency_key,state)
VALUES('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000012',repeat('a',64),'abandon',1,'in_SyntheticOriginal','t72-cancel-original','reconciling');
DO $$ BEGIN
 BEGIN INSERT INTO treido.billing_recovery_requests SELECT '00000000-0000-4000-8000-000000000013',intent_id,seller_id,actor_id,'00000000-0000-4000-8000-000000000014',input_hash,operation,expected_revision,invoice_id,'t72-cancel-other','creating',created_at,updated_at FROM treido.billing_recovery_requests; RAISE EXCEPTION 'Concurrent cancellation identity duplicated'; EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN UPDATE treido.billing_recovery_requests SET invoice_id='in_Other' WHERE id='00000000-0000-4000-8000-000000000011'; RAISE EXCEPTION 'Runtime modified immutable cancellation invoice'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
UPDATE treido.billing_recovery_requests SET state='complete' WHERE id='00000000-0000-4000-8000-000000000011';
DO $$ BEGIN
 BEGIN UPDATE treido.billing_recovery_requests SET state='creating' WHERE id='00000000-0000-4000-8000-000000000011'; RAISE EXCEPTION 'Terminal cancellation revived'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Immutable billing recovery request' THEN RAISE; END IF; END;
END $$;
UPDATE treido.billing_intents SET state='expired' WHERE id='00000000-0000-4000-8000-000000000007'; -- simulated AUTHORITATIVE VOID, not a provider claim
INSERT INTO treido.billing_intents SELECT '00000000-0000-4000-8000-000000000009',seller_id,actor_id,'00000000-0000-4000-8000-000000000010',input_hash,operation,catalogue_id,customer_binding_id,subscription_id,preview_id,expected_price_id,parameters,parameter_hash,'t72-synthetic-replacement',api_version,created_at,expires_at,'prepared',NULL,NULL,NULL,NULL,updated_at,0,NULL FROM treido.billing_intents WHERE id='00000000-0000-4000-8000-000000000007';
DO $$ BEGIN
 BEGIN UPDATE treido.billing_intents SET state='complete' WHERE id='00000000-0000-4000-8000-000000000007'; RAISE EXCEPTION 'Old late confirmation revived retired change'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Immutable billing intent' THEN RAISE; END IF; END;
 IF (SELECT state FROM treido.billing_intents WHERE id='00000000-0000-4000-8000-000000000009')<>'prepared' THEN RAISE EXCEPTION 'Replacement corrupted'; END IF;
END $$;
SELECT 'T72_SINGLE_USER_PASS';
`;
const input = path.join(directory, "assertions.sql");
fs.writeFileSync(input, sql.replace(/\r?\n\s*\r?\n/g, "\n") + "\n\n");
const exit = run(
  binaries.postgres,
  ["--single", "-D", data, "-j", "postgres"],
  input,
  "assertions",
);
const output = fs.readFileSync(path.join(directory, "assertions.out"), "utf8"),
  errors = fs.readFileSync(path.join(directory, "assertions.err"), "utf8");
if (
  exit !== 0 ||
  /ERROR:|FATAL:/.test(errors) ||
  !output.includes("T72_SINGLE_USER_PASS")
)
  throw Error("Single-user assertions failed; see " + directory);
console.log(
  "PASS: original 0001/0003/0031 + new0047; runtime grants, pending uniqueness, frozen invoice, revision and late-confirmation guards. " +
    directory,
);
