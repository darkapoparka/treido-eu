# T72 launch-feature regression packet

Run from `app/` using pinned Node 24.20.0 and pnpm12.3.4. Do not load `.env.local`. No real email, payment, private storage account, identity-provider session or shared database is used by this packet. See the [implementation receipt](../../../docs/audit/2026-10-05-launch-features.md) and [seller onboarding kit](../../../docs/seller-acquisition.md).

## Application and database checks

```sh
pnpm exec vitest run --configLoader native --maxWorkers=1 --no-file-parallelism
pnpm exec vitest run --config tests/t72/native.config.mjs --configLoader native
pnpm exec vitest run --config tests/t72/billing.config.mjs --configLoader native --pool threads
node tests/t72/billing-native.mjs
```

The regular unit selection includes mail/provider authority, attachment byte parsing and bounds, CSV preflight and billing recovery. The explicit billing configuration provides a focused rerun, not additional unique tests.

The launch native fixture creates fresh loopback PostgreSQL below `.qa/t72/native`, applies immutable repository migrations0001–0047 and grants the actual restricted runtime role. Its 12 cases exercise shared outbox execution, ready-attachment receipts and completed-job replay, atomic ordinary message attachment sends, participant-private delivery, corrupted stored bytes, foreign access, removal/send races, quotas, protected linked-image retention, mail acceptance/delivery distinction, uncertain-send recovery and current issuer restriction. Synthetic identities and a memory byte provider are explicit test inputs. External fetch is denied; production authorization, SQL, transactions and job handlers execute normally. Only the owned cluster is stopped, and its state and test data are retained.

The standalone billing script executes PostgreSQL in foreground single-user mode without a listening server. It exercises0001/0003/0031 plus new0047, runtime grants, exact invoice identity, pending-money uniqueness and terminal-state immutability. Its SQL annotation explicitly labels simulated provider void evidence; it does not qualify actual Stripe cancellation.

## Browser and production smoke

```sh
pnpm exec playwright install chromium
node tests/t72/attachment-browser.mjs
pnpm test:smoke:web --workers=1 --reporter=line
```

The attachment browser bundles the real hook and controls with explicit deferred Clerk/actions and byte-upload adapters in an isolated loopback page. Four multi-step cases check A-to-B concealment and stale stage rejection, sign-out hiding, old conversation response rejection, supported-file validation before upload, BG copy and320–1920px controls. It uses fresh headless Chromium and closes only its own browser/server. Screenshots and the result are retained in `.qa/t72/attachment-browser`. These are not actual Clerk or storage-provider acceptance, image-provenance approval, or matched Shop parity certification.

The smoke command requires the same isolated production build/output configuration documented in [testing](../../../docs/testing.md). Four new seller-onboarding cases join the nine existing cases. They exercise on-device CSV review, duplicate/error reporting, real issue download without file POSTs, clearing, deferred old-file rejection, pagination, BG controls at narrow/desktop/200% text and the real bilingual support routes. Both ordinary production and attempted reference opt-in run the complete selection in CI. Reference-only routes remain denied; the added guide and support paths do not depend on fake production data.

## Boundaries and deployment

The image intake accepts up to3MiB per still JPEG/PNG/WebP,20MP decoded input and four attachments per message, re-encoding to bounded WebP without source metadata. Stage/read/detach use current verified actor and conversation scope; PUT additionally verifies exact same origin and the expected signed-in subject. Authorized image responses are private/no-store and use unoptimized browser delivery rather than a shared image cache. Unsupported document/SVG/executable upload is not presented as supported.

Invitation mail requires explicit sender/domain/application/purpose configuration and an allowlisted recipient outside production. Unknown provider acknowledgement is retained, retried only under its original frozen identity within the provider dedupe bound, and is not displayed as delivered. PostgreSQL JSONB key reordering cannot change retry request bytes. Actual verified sender and test inbox delivery remain separate acceptance.

New billing updates require explicit current recently-authenticated billing authority and reviewed provider terms. Recovery is tied to the exact frozen invoice; old ambiguous portal flows are not declared cancelled on a local timeout. No automated charge or new payment resource is created by these tests.

Do not apply these migrations to a shared database, enable provider credentials, publish seller supply or deploy merely because this packet passes. Original task acceptance and deployment authorization remain independent. Prior failed local attempts are retained, not removed or relabelled as successful evidence.


The resumed mail-fairness regressions extend the launch packet from 12 to 14 database cases. Matching binding and frozen payload filtering happens before pagination; failed provider lookups retain acceptance and cannot starve the next due receipt. The historical 12-case result retains its original scope.
