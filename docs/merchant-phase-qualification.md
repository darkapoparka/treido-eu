# PRO B merchant delivery and qualification

October 11, 2026. Treido Global; existing `PRO`; canonical `app/` workspace. This records implementation and executed evidence for the existing [feature rows](features.md), not another task queue. [tasks.md](../tasks.md) remains the shared status owner. Source delivery is not Production activation or a main merge. The remaining release and genuine-acceptance gaps below are not waived.

## Delivered merchant integration

The phase extends the persisted domain implementation published at `44c7caa30f7632b9b2f1c5a5c503ca755b2aa0de`; it does not count `/admin-preview` actions as marketplace completion.

| Existing rows | Source capability and merchant integration |
| --- | --- |
| F02 / F11 | Direct personal selling remains independent of business setup. Business declarations, invitations, membership, roles and grants use current server authority. Studio destinations and read-only product review follow capabilities. Current memberships and unexpired pending invitations reserve seats. Operating seller selection is independent of public Personal/Businesses browsing. |
| F04 / F05 | Persisted drafts, current category/attribute requirements, original photo processing and publication/edit/withdrawal remain authoritative. Real product indexes expose unfinished or restricted supply. Publication-scoped availability denies withdrawn and stale buying sources. |
| F06 / F18 | Allocation-aware stock and variant commands are retained. CSV upload binds the exact file and current actor; preview, row correction/selection, bounded processing, pause/reload, persisted draft links and exports are connected. Uncertain uploads retain the original request; a verified cancelled import requires explicit restart. Inventory adjustments do not bypass reservations or silently restock refunds. |
| F12 | Buyer proposals, seller counteroffers, accept/reject/cancel and purchase entry retain immutable commercial terms and common allocation. Recovery preserves the original request and revision. Actor replacement, competing requests and mismatched retries cannot silently accept new terms. Ordinary conversation remains the buyer domain's integration. |
| F13 / F14 | Current Connect readiness diagnostics and recoverable provider links are exposed. Real quotes, authorized order queues, customer-filtered activity and exports use persisted facts. Buyer and seller payment-page actions differ while sharing the same financial/fulfilment state. Contact-only supply cannot masquerade as supported checkout. Accepted pickup/shipping/recipient facts and manual/simulated evidence labels remain intact. |
| F15 / financial F27 | Supported case/refund/fee/reversal/settlement/dispute contracts and original receipts are preserved. Exact terminal-full-refund repair remains narrow; partial, disputed or uncertain proof is blocked. Stock replenishment is a separate authorized command. Original refund replay is immutable and presents one explicit confirmation instead of a second fresh-refund form. |
| F16 / F19 | Four-plan quotas, invoices and promotion eligibility remain provider/server-owned. Studio exposes durable billing recovery history and truthful active/pending seat usage. Observe, deliberate abandonment and escalation retain the original intent and uncertainty. A local escalation receipt does not claim an external support message. Legacy opaque provider outcomes stay blocked until verified. |
| F17 / seller F29 | Real merchant Home counts drafts, restricted/withdrawn supply, failed photos, stock work, buyer offers, unfinished imports, fulfilment and financial follow-up. Bounded scoped counts link to actionable queues. Readiness derives from real product/photo/publication/order facts. Seller-authorized customer activity is not a fabricated CRM or invented supply. |
| Seller F22 | Studio Sell Helper uses permitted seller/draft context and persisted history. Proposals remain reviewable/correctable and require authorized acceptance; they do not autonomously publish or accept price, stock or commercial facts. No paid model credits were used. |
| Merchant F28 | The published Studio shell/component family is retained. Real navigation, operations, inventory, imports, helper and search are wired. Search now finds a current literal SKU as well as a title, scopes it by seller and listing and excludes archived variants. Keyboard selection, one-Escape close and trigger-focus return are connected to the real search dialog. |

## PRO commit anchors

These commits and their existing parents are preserved on PRO; they are not a replacement branch or unpublished local patch.

| Commits | Changes |
| --- | --- |
| `7dd51a8`, `4840491` | Real merchant Home/personal selling; authorized order/customer activity and exports. |
| `f66702e`, `01add65`, `667b3ea` | Studio helper/history/capability navigation; Connect readiness/recovery; real product/order/customer search. |
| `ca4df97`, `d2f7f2f` | Durable billing/seat facts and immutable negotiated-offer recovery. |
| `569926c`, `a9663b9`, `1df8167` | Current-actor CSV upload/progress/restart and actionable operating queues. |
| `fd9661f`, `b7512fb`, `1145c41` | Publication-scoped stock, current session/action transport and phone stock/import qualification. |
| `0741e3e607d9179d6dd61ea745f6a63f5ddd8cb8` | Fixed browser Event globals; the previously failing integration lint passes. |
| `3f1a125c358f9df9967c5cc896e5392a83cc285e` | Persisted literal-SKU search, single-Escape close/focus return, native owner isolation and SQL-backed browser coverage. |
| `3d83c12ad0fbd6e66881063526430787dea8cdca` | Corrected the obsolete order-session fixture to assert concealed fresh actions and immutable saved refund text with one unchecked confirmation. No production action was weakened to satisfy the old fixture. |

The resumed source changes were published directly through GitHub, preserving concurrent A commits including `7151c76`, `adc4b11`, `87faa46` and `2be08e9`. No force push, main merge, additional checkout or worktree was used.

## Executed qualification

Every result is pinned to the source actually tested. Documentation does not retrospectively change a tested SHA. A and B reused the canonical checkout/dependencies and coordinated the single build output; B did not fast-forward source or launch a competing build during A's lease.

| Check | Executed result |
| --- | --- |
| Full units, `adc4b11` | **3,069 passed; 1 skipped; 0 failed.** The configured-Neon read-only opt-in was skipped, not falsely counted as provider qualification. |
| Native database and connected stock/import/search browsers, `adc4b11` | **230 passed; 2 skipped; 0 failed.** Real isolated PostgreSQL stock, cart, offers, publication, CSV and Studio search passed. The two omitted modes are separate buyer public-discovery and library browser opt-ins. |
| Dedicated aftercare native, `2be08e9` | **19 passed; 0 skipped; 0 failed.** Native PostgreSQL, synthetic recent authentication/provider adapter; external fetch forbidden and zero external attempts required. |
| Dedicated legacy billing native, `2be08e9` | **4 passed; 0 skipped; 0 failed.** Original opaque-intent observation/recovery was exercised with isolated SQL and a synthetic provider; no genuine external subscription was reconciled. |
| Merchant session browsers, `87faa46` | **Team 17, seller settings 36 and import sessions 19 scenarios passed**, with no page errors. These exercise real components with deferred synthetic identity/actions, not real Clerk or provider sessions. |
| Order/checkout session browser, published `3d83c12` | **28 scenarios passed**, with no page errors; its lint and formatting passed. The exact published test was executed through stdin against `2be08e9`, after verifying runtime source/package/lock contents were identical. The shared checkout was not modified. Total scoped merchant session scenarios: **100**. |
| Strict source checks, `87faa46` | Web lint, maintained native lint, contract types, Next route generation and strict web types passed. A's later CI-format correction in `2be08e9` also passed. |
| B integration lint and release-script regressions, `87faa46` | All six maintained merchant/marketplace browser transport paths passed with zero allowed warnings. **66 release-script tests passed**, no skips/failures. Seven final merchant search/browser paths passed formatting. |
| Current production build, `2be08e9` | **Standard Next production build passed**, source unchanged. This includes the final merchant runtime from `3f1a125`; `3d83c12` changes only a test. Existing preview and callback runtimes were preserved. |
| Current production-output checks, `2be08e9` | **175 traces; 3,161 bundles; zero findings.** Output checks found no forbidden node-forge/braces/micromatch packages in the delivered web output. This is not a raw dependency-audit waiver. |

The connected stock/import/search browser includes literal `%_` SKU search, a duplicate SKU in another business, archived-SKU exclusion, keyboard result focus, one-Escape close, and current-access denial after an isolated owner-to-buyer switch and foreground revalidation. Stock, CSV and search were exercised at **319, 393 and 1440px** with BG/EN content.

Compact original execution receipts remain local under `.qa/pro-b-20261010/` and the corresponding A source/stock/release directories. Secrets, environments, private recovery files, test databases and full failure logs are not published. Native/synthetic evidence is not represented as genuine Clerk/Stripe acceptance.

## Rendered evidence

[The evidence manifest](merchant-evidence/manifest.json) records exact local paths, dimensions, byte counts and SHA-256 hashes for three inspected native-browser screenshots: current English SKU search at 319px, Bulgarian allocation-aware inventory at 1440px and Bulgarian completed CSV import at 393px. The 319px stock/import counterparts were also inspected. These are actual persisted test workflows rendered through merchant components, not `/admin-preview` or lawful live supply. A compact presentation copy of the search screenshot is supplied in the conversation; the original PNG remains local.

The existing signed-in Shopify Home and settled empty Products pages were inspected read-only in the owner's existing browser. Window-only captures remain local. No Shopify store/product/plan/account was changed. This supports the observed shell/navigation/empty-state treatment, not pixel-perfect acceptance for unobserved populated orders, every editor/dialog or mobile reference state. B did not reset/reinstall/change the Shop emulator or claim fresh native Shop parity.

## Remaining release and external acceptance facts

**The combined release is not fully green at this receipt.** On `2be08e9`, each production smoke mode passed 18 tests and failed the same exact Bulgarian support-copy expectation in `tests/smoke/seller-onboarding.spec.ts:244`. A's `shopping-session-browser.mjs` failed its ready/checking assertion and `assistant-input-display-browser.mjs` failed its original-retry enablement assertion. These buyer/support checks were reported to their current owner; they are not counted as passed merchant evidence. The raw pinned-pnpm audit exited 1 with **two high findings in mobile/Expo dependency paths, node-forge and braces**. The clean web output audit does not close that shared release gate. Later A fixes must carry their own exact rerun evidence.

The October 10 genuine isolated TEST original-photo/publication, two-human text send/reply/reload, Stripe payment/recipient transfer and simulated pickup receipts remain preserved baselines. Full refund/transfer reversal with duplicate-webhook idempotency, unpaid cancellation releasing stock once, and a fresh automatic purchase consuming stock once are preserved; this resumed native qualification did not repeat genuine Stripe transactions. The original application fee was zero: that receipt does not qualify nonzero fee reversal, broader partial refunds, carrier delivery, bank payout, subscriptions or boosts.

Approved commercial/legal/tax policy, current category publication approval, lawful live supply, live Connect/payment eligibility, supported shipping/carrier/aftercare rights and approved live plan/promotion catalogs remain actual external acceptance facts. No external recipient messages or live financial effects were initiated. Sell Helper live model quality remains unqualified by paid calls; no paid credits were consumed.

Legacy uncertain external money remains visible and blocking until the original provider outcome is verified. A recovery receipt, browser redirect, manual dispatch or simulated pickup is not payment, reversal, bank-payout or delivery proof. A full genuine multi-business/team/provider matrix and every merchant visual state are not certified by the scoped tests above. This receipt does not close those acceptance gaps or grant Production activation.
