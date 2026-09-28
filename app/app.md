> **Donor/reference document retained on 27 September 2026.** This file records the original Shop/Foods source context, not this derivative's product requirements or current execution policy. Read [the product README](../README.md) and [current tasks](../tasks.md). Never follow an old source path or donor remote to perform work for Treido Global.

# Seller operating platform and storefront CMS

`app.md` names the merchant PRODUCT, not a new app folder. The initial implementation belongs in separately authorized merchant routes inside `apps/web`; the selected architecture stays one browser/backend deployment. This is a requirements contract, not a claim that the dashboard is implemented.

## Design direction and users

Build Shopify-like operational depth for food manufacturers, not a decorative analytics template. The exact Shopify web capture is recorded in [shopify/README.md](shopify/README.md); its screens/flows are not acquired yet. Until inspected, the requirements below are Treido design proposals and must not be described as a 1:1 Shopify implementation or its underlying backend.

A seller always sees the active business, their permitted actions and actual operational state. Support owner/manager/member roles as explicitly configured, empty/new businesses, populated businesses, revoked membership, suspended publication and safe business switching. Authority is checked in each server operation, not just menus.

## Required workspaces

| Workspace | Complete behavior |
| --- | --- |
| Setup/home | Business identity, verification submission/status, setup checklist and real order/stock/exception attention queues |
| Products | Draft/create/edit/archive, variants/SKUs, category facts, units/packs, quantities, price, media order, translations, publication validation and preview |
| Bulk work | Explicit selection scope, import dry run, row errors, atomicity/partial results, duplicate-safe retry and permissioned export |
| Inventory | On-hand/reserved/available, locations and applicable lots/expiry, auditable reasoned adjustments; no client-only stock ledger |
| Orders/fulfillment | Search/filter queues, immutable purchased facts, payment versus fulfillment state, allowed transitions, pickup/delivery offers, exceptions and approved cancellation/refund allocation |
| Customers/inbox/reviews | Authorized order context, durable conversations, attachments, unread/reconnect, eligible reviews/replies and abuse escalation |
| Finance/analytics | Period/currency definitions, traceable captured/refunded/fee/settlement totals, drill-down, unknown-cost handling and truthful payout state |
| Store/CMS | Business content and controlled storefront customization with draft/preview/publish/version/rollback |
| Team/settings | Invitations, least-privilege roles, revocation, contact, notifications, fulfillment and business settings |
| Premium/AI | Authoritative entitlements, configured billing and approved assistance; ordinary commerce remains available without either |

MER-001 through MER-010 remain the feature IDs. Every enabled action has persisted outcomes and actionable errors. Empty metrics are not synthetic charts. A paid status does not imply fulfillment or payout eligibility.

## CMS contract: refine MER-008

A store has a stable identity and published version separate from the working draft. Editors manipulate an approved section/block schema, not arbitrary executable HTML or JavaScript. Initial candidate sections include producer story, hero/media, product collection, category navigation, announcement and fulfillment information. The final template set, token limits and layout are DEC-006 decisions, not measured Shopify facts.

Each section has a stable ID, type, schema version, ordered position, locale content and validated settings. Product/collection references are tenant-scoped and can become unavailable without breaking the page. Shared buyer components render both preview and published output. Do not create a separate fake preview renderer that diverges from what buyers see.

**Draft:** save with revision/conflict detection; show dirty/saving/saved/error state; warn about leaving unsaved work; recover failed uploads without losing the form. Media is owned by the correct business and retains publication rights metadata.

**Preview:** authorized, clearly marked and excluded from public indexing. Preview capabilities expire and cannot reveal private customer/financial data. Device controls select compositions; they do not merely shrink a desktop screenshot.

**Publish:** reauthorize membership and business status; validate schema, accessibility limits, media, referenced products and required food facts; publish an immutable version atomically; record actor/time/revision; invalidate only affected public projections. Report real success only after the durable operation completes.

**Rollback:** create an auditable new publication pointing to an eligible prior version, subject to current validation and authority. Do not restore suspended products or revoked assets merely because an old version referenced them. Handle concurrent editors and stale publish confirmations explicitly.

Store customization may change approved content, sections and tokens. It cannot hide mandatory food/price/fee information, impersonate platform trust, inject tracking scripts, cross tenant boundaries or modify checkout policy. Custom domains and paid plans are separate optional activation decisions, not setup side effects.

## Food-specific operations

Provide structured category-applicable food facts; keep supplier/manufacturer evidence and publication review distinct. Unknown allergens are not allergen-free. Lot/expiry belongs to applicable inventory, not one universal product date. Weighted quantities use the approved precision and unit model. Substitutions, actual-weight adjustments, cold-chain claims and delivery promises need approved operational capability and buyer consent where relevant.

## Device and acceptance matrix

Desktop has efficient semantic tables, filterable queues, keyboard navigation, stable action columns, selection and usable pagination. Phone web supports urgent order/stock/customer actions and readable editors; do not hide essential work behind a blanket desktop-only message. Preserve return context and unsaved state.

For each workflow test populated/empty data, BG/EN, phone/desktop, authorized/restricted/revoked roles, duplicate/stale submissions and cross-business resource IDs. Verify server persistence and the public buyer result after publishing. CMS additionally needs draft isolation, version conflict, failed publish, rollback and cache invalidation evidence. A signed-out redirect does not verify an authorized merchant workspace.
