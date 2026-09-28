> **Donor/reference document retained on 27 September 2026.** This file records the original Shop/Foods source context, not this derivative's product requirements or current execution policy. Read [the product README](../README.md) and [current tasks](../tasks.md). Never follow an old source path or donor remote to perform work for Treido Global.

# Platform administration

Owner: separately privileged admin routes/services in `apps/web`. ADM-001 and the operational portion of ADM-002 are defined in [product requirements](docs/product/requirements.md). This is planned platform functionality, not part of the current Shop screenshot scope.

## Authority

Platform permissions are granted explicitly. Seller ownership, a Premium plan, a guessed admin URL or a hidden menu does not grant them. Enforce permission and resource scope on every loader, action, handler, export, attachment and background operation. Test direct endpoints and revoked/stale sessions.

Separate routine moderation/verification from exceptional financial/support powers. Any break-glass or impersonation capability needs its own approved design, audit and justification; it is not included by implication.

## Workflows

Business verification and product/content review need submitted evidence, a decision reason, changes-requested/rejected/approved states, notification and an appeal/escalation path where configured. A checkmark cannot be generated from unreviewed claims.

Reports, reviews and messaging abuse need bounded context, evidence retention rules, allowed moderation actions and durable history. Operators see only data required for the assigned work. Avoid copying private customer records into public test artifacts or unrestricted AI context.

Commerce exceptions use the canonical order/payment/refund services, never manual UI-only status edits. Show consequences and require current authorization/confirmation before money, account suspension or irreversible publication actions. Duplicate requests must not duplicate effects.

Promoted placements require eligible content, disclosed labels, configured scheduling, tenant-scoped management and honest attribution. Pricing and commercial activation remain decisions; admin UI cannot silently invent paid terms.

## Acceptance

Every consequential decision records actor, permission context, resource, action, reason, time, result and correlation identity without unnecessary sensitive payloads. Test authorized/restricted/revoked roles, another tenant's IDs, concurrent state changes, provider uncertainty and duplicate actions. Audit, retention/deletion, backup and incident workflows must be qualified before public release.

Use efficient queue/detail layouts, accessible forms, explicit destructive confirmation and useful loading/empty/error states. Shopify merchant references do not prove the required platform-admin authority or design; review this surface independently.
