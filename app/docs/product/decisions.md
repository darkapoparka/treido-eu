# Product decisions

This register owns current decision status. The dated calculations and category proposals in [requirements.md](requirements.md) remain proposals until an explicit approval is recorded here. The new documentation branch does not approve them.

## Owner-confirmed product direction, 2026-09-12

The owner clarified that Treido must become a food-manufacturer/producer marketplace, including eligible homegrown/small-producer foods. First finish Shop buyer UI/UX parity; then adapt the same implementation. The food homepage must present containers of manufacturers with their own products, not keep captured Glow/general-shopping brands or an unrelated general-product catalog. [product.md](../../product.md) owns the destination and [web.md](../../web.md) owns the producer-shelf experience.

This direction is settled and need not be asked again. The detailed screen composition and acceptance cases in web.md are the implementing specification, subject to the later food design review. The clarification does not approve current source fidelity, final brand pixels, seller/legal eligibility, taxonomy details, payment policy, public release or immediate food-UI implementation. Those boundaries remain below.

| ID | Decision | Current status | Blocks only |
| --- | --- | --- | --- |
| DEC-001 | Exact buyer source, platform exceptions, source approval, seller/admin presentation | Shop corpus frozen; source acceptance outstanding. Shopify web source selected but not acquired; merchant CMS contract is Treido-authored, not a visual reconstruction claim. | Affected fidelity claims, source/brand gates and seller reference matching |
| DEC-002 | Fee base/rounding, multi-seller purchase/payment model, refunds, settlement responsibility and methods | Existing detailed proposal and examples retained; owner/provider approval outstanding | Real payment/recovery acceptance and live money, not fixture UI |
| DEC-003 | Food taxonomy, units/precision, publication facts, allowed seller categories and partner activation | Producer-first direction confirmed above; existing taxonomy/quantity/partner proposals retained, detailed approval outstanding | Dependent publication and partner activation, not reference work |
| DEC-004 | Launch legal/privacy/food/tax policy, billing/promotional prices, retention/deletion and release identity | Unresolved; qualified review and exact configuration required | Affected promises and release |
| DEC-005 | Durable jobs and realtime providers | Choose against actual payment replay/communication needs; no new provider selected in this batch | Provider-dependent production acceptance |
| DEC-006 | CMS templates/sections, customization limits, publication review and domains | Draft/versioned CMS requirements added in app.md; exact design, template set and optional custom domains not approved | Final editor design and optional domain activation |
| DEC-007 | AI use-case enablement, budgets, retention and consequential-action permissions | Human-reviewed drafts by default; concrete model/tool/eval budgets chosen with each feature | Paid/live AI activation, not ordinary marketplace operation |

Record each approval with date, owner, exact values/examples, scope and affected tests. Technical implementation within the selected architecture is the implementing agent's responsibility. Do not ask the owner to resolve routine code choices; do not make commercial decisions on their behalf.

An unresolved decision blocks only its dependent action. Build independent UI, tests and contracts without inventing a fake approved value. Where a policy value is needed for reference rendering, isolate and label it as source fixture data rather than production configuration.
