# Environments, reliability and release

This is a release checklist and operational contract, not a claim of configured infrastructure or legal approval. The owner says accounts are available; intended project/account/mode/resource bindings remain unverified by this documentation task. [Launch](launch.md) defines the complete October 1 morning target and [tasks](../tasks.md) owns progress. No provider/shared data or deployment was changed here.

## Environment separation

Use isolated development/test, preview and production bindings. Never copy donor credentials or point local tests at shared data. Keep secrets in approved environment/secret storage, not Markdown, fixtures, browser bundles or logs. Validate required configuration at startup; product mode with missing services fails explicitly rather than selecting a sample adapter.

When their integrations are added, document these proposed names in a validated environment schema and `.env.example` containing names/dummy placeholders only:

| Integration | Proposed variables / handling |
|---|---|
| Data mode | `TREIDO_DATA_MODE=reference|database`; product production rejects reference mode |
| Database | `DATABASE_URL` for runtime; `MIGRATION_DATABASE_URL` for privileged migration path |
| Clerk | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`; use supported SDK routing/config |
| Media | Provider-specific endpoint/bucket/access names under `OBJECT_STORAGE_*`; all credentials server-only |
| Payments | `STRIPE_SECRET_KEY`, separate webhook secrets per endpoint/purpose; explicit account/mode mapping |
| Jobs | Inngest app/environment/event/signing bindings plus `CRON_SECRET` or equivalent for outbox repair; never a public query-string secret |
| Mail | Resend server key and verified sender only when enabled; no real sends in fixtures |
| Error capture | Sentry project/environment binding, server upload credential when needed, redaction/sampling; session replay off initially |
| AI | Gateway-supported server credential/host identity; qualified model IDs, money/run budgets and tracing/retention; direct `OPENAI_API_KEY` only if that adapter is selected |
| Commercial catalogue | Explicit environment/purpose-to-Product/Price mapping; plan/fee/promotion versions are validated server configuration, not browser input |

These are proposals, not installed variables. Keep existing `SHOP_REFERENCE_PREVIEW`, `SHOP_PARITY_DIST_DIR`, `SHOP_PARITY_TSCONFIG_PATH` and scenario controls limited to reference behavior while migrating. Do not rely on a platform-specific `VERCEL_ENV` check alone to secure product mode on every host.

## Selected resources and staged qualification

D28 selects Vercel Node/Fluid, Neon PostgreSQL, Clerk, Resend and Sentry; D29 selects Inngest for effects and D32 adopts the existing private Neon Object Storage adapter for launch integration. These engineering choices do not assert that production resources are qualified. Record non-secret account/project/environment/resource identities, owner, region/processor settings, callback origins, service limits and spending alerts when the consuming task binds them. Keep keys in approved secret storage. T04a initially needs only Clerk and Neon plus the application origin; an unbound mail/storage/job provider does not block pure policies or the auth/database slice.

| Consumer | Required evidence before integration is called qualified |
|---|---|
| T04b identity/data | Intended Clerk test instance; isolated Neon development/test target, schema/synthetic seed, restricted runtime role and separate migration role; session/subject mapping and denial/transaction tests |
| T04f jobs | Intended Inngest app/environment; signing verification, event/step data minimization, processing-region/retention review, actual execution/concurrency limits, outage/redrive evidence; no claims of EU-only processing without verification |
| T06b media | Intended R2 bucket with EU jurisdiction where required, private access, purpose-specific prefix/credentials, CORS, lifecycle and byte-validation/delivery-removal proof |
| T10a/notifications | Resend sender/domain ownership, sandbox/test recipient policy, idempotency/delivery ledger and consent/retention; invitation links scoped and expiring |
| T12/T13/T26 | Exact Stripe account/mode/capabilities, charge funds flow, prices/fees/policies and refund/reversal recovery; no copied test IDs or browser-paid authority |
| Hosted preview/release | Intended Vercel project for this repository, Node region near Neon, isolated secrets/events/assets and synthetic data; Sentry redaction/source-map access, budgets and named alerts |

Prefer an EU application/database pair for Bulgarian latency and the reviewed data policy. R2's [EU jurisdiction](https://developers.cloudflare.com/r2/reference/data-location/) is distinct from a best-effort location hint. Hosting in Europe does not establish the location of every identity, email, telemetry or workflow processor. Verify their actual settings/agreements without promising compliance from geography alone.

Use schema-only or sanitized/synthetic test data by default. A database branch can inherit its parent's private data; branching is not anonymization. Keep live Stripe, customer mail and production jobs disabled in previews, and constrain callback/continuation URLs to the intended environment. Paid resource provisioning and public deployment still require their authorized tasks.

Recheck shell/runtime against package pins and select a per-session toolchain. The owned launcher uses loopback 6418 and `.qa/treido-preview`; it was running from the canonical root during September 30 planning with Node 24.21.0. That observation does not replace T01 fresh-install qualification or the manifest pin. Do not start a duplicate process, reuse a donor port or stop another project's preview. Only terminate task-owned processes by exact verified PID when needed.

## Build, CI and release

The job/media consumer now has configuration slots in `app/apps/web/.env.example`. Verify the intended Inngest app/environment, private EU R2 account/bucket/prefix and allowed loopback origin before adding secure credentials. Syntax validation does not prove target ownership, bucket privacy, jurisdiction, CORS or callback delivery. Do not bind another available resource by inference. The same Inngest app hosts signed execution and a one-minute repair sweep; qualify actual scheduling/acceptance and configure an owner for sanitized terminal-failure alerts. Manual repair uses `CRON_SECRET`; audited redrive requires the separate `TREIDO_OUTBOX_REDRIVE_SECRET`. Non-production storage prefixes start with their declared purpose. Review bucket CORS for only the qualified origin, PUT method and signed content type; retain private access. Frozen/orphaned inputs and detached assets need scoped retention cleanup before media acceptance can be complete. No public bucket, production event, lifecycle deletion or provider setting was changed by the local implementation.

Use a clean frozen install and exact lockfile, current pinned runtime and reviewed build-script exceptions. Validate type/lint/unit/build, then product and reference boundaries, relevant browser tests and isolated database/provider tests. Dependency “latest” is not a vulnerability audit; check advisories and record actual findings/false positives before release.

Before further publication to the connected public GitHub repository, inspect the actual staged files, secrets/history and asset rights. The final audit verified matching local and remote main; this does not qualify already published material. Review existing public content too and obtain authorization for any required remediation. The copied source includes substantial private reference material and reference font/media handlers. Do not push all 715MB of historical source assets by reflex. Define what belongs in Git, private reference storage and production assets, preserving local originals. Adding a remote must not overwrite a donor remote or force unrelated histories together.

For the selected Vercel Node/Fluid target, qualify the project/region and co-located database, verify provider limits and error/timeout behavior, then bind a preview. Retain a standard Node build path; measured incompatibility can justify a host change without replacing the domain. No public deployment or DNS changes without an authorized release task. A deployed URL does not mean qualified commerce.

## Reliability and measurement

Start with structured request/error logs and actionable alerts: failed publish/upload/send, webhook processing delay, exhausted jobs, unresolved payments, expired allocations, database saturation and elevated latency/error rates. Restrict sensitive logs and use retention limits. Do not log full messages, private addresses or tokens for convenience.

Add Sentry error capture/tracing with the first hosted real slice, keeping request bodies, private form values, tokens and message content scrubbed and session replay disabled initially. Correlate request → command → outbox → executor run → provider object with non-secret IDs. Instrument the first database adapter/consumer instead of postponing basic visibility until T27c; that task qualifies full restore/operating recovery.

For jobs measure oldest unprocessed outbox age, executor handoff delay, completion latency, retries and terminal/reconciling counts. Separate a transient provider outage from a poison job; redrive only with reason/capability and the same effect identity. Independently schedule the small outbox repair sweep so an executor dispatch interruption cannot lose committed work. Test its credentials and host scheduling limits; never rely on an undocumented free-plan frequency.

Record baseline and budget for database/pool saturation, compute/image processing, R2 operations/egress, Clerk active users, executor steps, mail volume, telemetry and AI. Establish tested alert thresholds and restore objectives before launch, with an accountable owner. No total monthly cost or uptime guarantee is inferred from starter-template marketing or a free-tier headline.

Measure real user outcomes and p75 page performance for major mobile journeys. Establish baseline LCP/INP/CLS, response sizes and query counts before setting regression budgets; record device/network/sample rather than quoting a meaningless single score. Load-test bounded search, uploads and the purchase race at representative concurrency before money release.

Configure database backups and restore procedures, object retention and migration rollback/forward-fix plans. Perform a restore drill on an isolated target, then reconcile external payment/provider effects: a database restore cannot undo a charge or payout. Define recovery objectives and an operator owner before production; no invented SLA in marketing.

The operating console has restricted queues for listing reports/declarations, order/return cases, unresolved payments/refunds/transfers, billing/promotion exceptions, failed imports/uploads/notifications and exhausted jobs. Each action requires a capability and records a reason/audit trail; no unrestricted impersonation or manual paid-success flag. Access/support needs are explicit assignments in T27, not a generic dashboard that exposes every private record.

Account export/closure applies reviewed retention and protects open order/payment/legal obligations. Export is human-owned and independent of subscription; redact others' private data. Revoke access, remove unnecessary uploads/AI media and expire download links. Inform the user of retained categories/purposes and expected handling. Review model/media retention, prompt logging and provider data-processing settings before AI exposure.

Fulfilment support handles seller shipment/pickup confirmation, tracking where supported, delivery failure, cancellation boundaries, returns, partial refunds, disputes and settlement. Test the actual selected carrier/pickup process and provider account. Do not advertise platform-paid delivery, escrow or guaranteed protection based on a fixture or owner account availability.

## Marketplace safety and legal launch review

Have a qualified Bulgarian/EU adviser confirm applicability and implementation for the actual entity, platform model and countries. This is an engineering checklist, not a legal opinion. Do not copy another site's terms or interpret “private” as an exemption for someone operating as a trader.

| Area | Required release evidence |
|---|---|
| Seller transparency and buyer rights | Trader/private disclosure, verified applicable trader details, return/withdrawal and statutory/commercial guarantee wording; business does not imply all goods are new |
| DSA | Applicability/size assessment, notice/action, reasons/appeals, contact and trader-traceability process appropriate to the actual service |
| GPSR / product safety | Category rules, required product/economic-operator information, Safety Gate/contact obligations, recall and dangerous-product response |
| DAC7 / tax | Adviser-reviewed platform scope, seller due diligence, reporting and retention; do not hard-code copied thresholds without review |
| Privacy / GDPR | Lawful purposes, minimization, consent where needed, processor/transfer review, security, export/deletion/retention and data-breach response |
| Commerce and payments | Actual seller onboarding, provider/country eligibility, fees/tax/invoices, delivery, cancellation/refunds/disputes and settlement responsibilities |
| Accessibility | Keyboard, screen-reader, contrast, focus, errors, reduced motion and applicable accessibility obligations for launch scope |
| IP and assets | Treido branding plus owned/licensed fonts/images/copy; no captured personal details or unauthorized reference assets exposed |

“Sell everything” means a broad reviewed marketplace, not unsafe or illegal categories. Keep prohibited/restricted categories disabled until supported policy and enforcement exist. A report button, moderator queue and removal enforcement are prerequisites for exposing user listings, not optional future polish.

Primary starting points: [EU shopping rights](https://europa.eu/youreurope/citizens/consumers/shopping/shopping-consumer-rights/index_en.htm), [DSA](https://digital-strategy.ec.europa.eu/en/policies/digital-services-act), [GPSR](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=LEGISSUM%3A4670517), [DAC7](https://taxation-customs.ec.europa.eu/taxation/tax-transparency-cooperation/administrative-co-operation-and-mutual-assistance/dac7_en). Recheck current national rules at launch; documentation written today is not evergreen legal approval.
