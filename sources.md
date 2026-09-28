# Source register — Treido Global

## Verified source copy — 27 September 2026

**Application source now exists:** `L:/CODEX/platforms/treido/app`. Main web owner: `app/apps/web`. No need to copy or scaffold again.

Original reference retained unchanged: `L:\CODEX\treido-bg`, branch `main`, HEAD `7ab4dd99c535f88806b63ef2457e203021253cc9`. 7,775 copied files / 715,450,113 bytes passed SHA256 verification; relevant working-tree changes were copied. Full donor Git history remains at the original reference; no donor .git/remote is installed inside app.

This is a source baseline, **not a boot-tested or product-complete application**. No dependency install, UI adaptation, database work or deployment was performed. Required workspace/lockfiles, public assets and source reference contracts were retained. Donor private environments, generated caches, browser-state QA and source automation remain at the original location and were not activated in the derivative.

Manifest: [source-copy verification](../_organization/2026-09-27-finalize-185118/treido-source-copy.json).

The earlier audit entries below are historical checkpoints, not the current copy commit. Current working root is the product app/ above.


## Verified inspection and provenance — 27 September 2026

- L:/CODEX/treido-bg — current Shop reconstruction; main at c6088658394e, 30 status entries during audit; port 6412 active. This reference also contains food-product documentation, which must not be mistaken for Global scope.
- Obqvi's existing product model covers general goods, businesses and services; reuse relevant requirements rather than starting a competing universal marketplace.

## Organized local references

- [obqvi](../_legacy/obqvi/) — verified 7,058 files; source `M:\obqvi`; HEAD 675a87a5b497 on `main`; original retained.

Exact file hashes, source/destination Git state, environment-file preservation counts and cache exclusions are in `../_organization/2026-09-27-pro/migration-<source-id>-manifest.json`. The source audit, documentation backup and migration summary are stored beside them. No credential values are reproduced in these product docs.

## Current recommendation and limits

Shop is the proposed single visual/code base. Adapt seller-profile/product containers within its original components, spacing and typography; do not import a second CSS system.

Recommendation: park Obqvi as a separate build queue and bring overlapping discovery/business-directory requirements into this workstream. A distinct alo.bg-style audience would need an explicit separate product decision.

These are source-based recommendations, not a new visual approval, external app review, backend connection or production-readiness verdict. Read actual source manifests when implementation starts; do not upgrade from a version written in old prose.

## Prior source notes — retained historical context

The following material is preserved from the earlier documentation pack. References to a previous final pass, selected stack, current source path or provider inspection describe that prior context, not new verification in this organization session. Current scope and path decisions are above.


## Basis

Historical/context appendix, not build instructions. The current README, PRD, design, stack and tasks govern this derivative. Consult only to answer a specific missing question; do not reopen source-selection, old branches or old phase gates as setup.

## Historical decisions

These notes preserve where earlier ideas and proposals came from. Active requirements and open choices are in the PRD; money policy is in billing.md.

Responsive web first; native Expo, cross-border selling and richer inventory are retained later decisions, not implied by Android-inspired web screens.

The source's BUY/selling/business/ENT/BILL/commerce/trust/measurement families remain represented. Preserve quantity-one order scope and Free/Pro distinctions; do not inherit the old full-Shop-parity-before-any-product-work queue.

Seller subscriptions and item transactions are separate products, customers/attempts and revenue measures. Initial subscription direction is monthly Pro only. The source's EUR 7.99 personal_pro and EUR 14.99 business_pro are explicitly sandbox fixtures, not approved production pricing. Transaction fees remain inactive policy until reviewed; do not import Foods' 5% + EUR 0.50.

Detailed plans/access/fees and unresolved choices belong to [billing.md](billing.md), not inherited donor marketing.

- Confirm production Prices, catalog limits, tax/fee model and refund rules; sandbox values must stay test-only.
- The current code clone/checkpoint must be selected by file state, not the similar treido-global/shop-app remote names.
- Old Supabase architecture is historical context; this new derivative selects Neon and a clean schema, not a migration of live data.

## Recorded source runtime and inspection context

Use the selected Shop snapshot manifest. No new dependency installation or runtime qualification was performed for Global.

Earlier provider inspection did not establish live Neon/Stripe mappings. That old tooling outcome is not a current access restriction: use the current authorized tools during integration.

<a id="technical-references"></a>
## Technical references

Primary API references; use documentation compatible with the installed runtime. They do not establish account access. Codex guidance, Drizzle’s Neon driver support and Stripe webhook behavior were checked in this final pass.

- [Codex instructions](https://developers.openai.com/codex/guides/agents-md)
- [Codex subagents](https://developers.openai.com/codex/subagents)
- [Drizzle/Neon drivers](https://orm.drizzle.team/docs/connect-neon)
- [Transactions](https://orm.drizzle.team/docs/transactions)
- [Clerk/Neon](https://clerk.com/docs/guides/development/integrations/databases/neon)
- [Stripe events](https://docs.stripe.com/webhooks)
- [Subscriptions](https://docs.stripe.com/billing/subscriptions/overview)
- [Connect charge types](https://docs.stripe.com/connect/charges)

Runtime and source history are not instructions to upgrade dependencies or repeat an earlier audit.
