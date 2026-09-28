> **Donor/reference document retained on 27 September 2026.** This file records the original Shop/Foods source context, not this derivative's product requirements or current execution policy. Read [the product README](../README.md) and [current tasks](../tasks.md). Never follow an old source path or donor remote to perform work for Treido Global.

# AI product contract

Treido's AI should save time and improve decisions within real commerce workflows. It is not the authority for food facts, prices, stock, permissions or payment outcomes. MER-010 and the AI part of the buyer reference are distinct scopes. This document specifies future behavior; no AI provider is activated by these docs.

## Useful first applications

| Capability | Grounding | Output and boundary |
| --- | --- | --- |
| Listing assistant | Authorized seller input, product facts and lawful images | Draft titles/descriptions/category/attribute suggestions; missing facts identified; review before publish |
| Translation | Seller-approved source text and terminology | BG/EN draft preserving numbers, units, ingredients and warnings; review sensitive facts |
| Buyer discovery | Public eligible catalog and supported filters | Relevant products with real price/availability and clear source facts; no invented stock or allergy safety |
| Seller operations | Authorized orders, exceptions and permitted next actions | Explain/summarize/draft; confirmation plus fresh authorization before consequential execution |
| Analytics/inventory | Defined, permissioned metrics and stock history | Reproducible comparisons with period/currency and missing-data disclosure; no invented profit/demand |
| Customer replies | Authorized conversation/order context | Draft for human review; no autonomous sending by default |

Voice/image-assisted source UI remains a reference obligation; a rendered composer is not a functioning voice or AI service. Enable real capabilities only with their explicit workflow, tool and evaluation contracts.

## Server-owned execution

Keep provider credentials on the server. Authenticate the user and establish resource permissions before retrieval. Tools accept validated bounded inputs, not arbitrary SQL, broad file access or tenant IDs as authority. Reauthorize at execution after approval because membership and resource state may have changed.

Treat listings, images, uploaded files, messages and retrieved content as untrusted data. Embedded instructions cannot grant tools, switch business context, reveal secrets or override policy. Client instructions and model output never bypass the canonical command services.

Use schema-validated structured output for machine-consumed drafts. Validate business semantics after parsing: correct units, existing IDs, permitted resources, approved facts and allowed transitions. Invalid or unsupported output is a recoverable error, not silently accepted data.

Each generation/action has an identifier and records the authorized context, input/source versions, prompt/model/tool versions, usage and review/execution state with minimized sensitive content. Define retention and deletion; keep traces private. A model upgrade must not silently change already-approved draft or action semantics.

## Human approval and food safety

Publishing, sending messages, changing inventory/prices, charging/refunding, changing permissions or other consequential mutations require an explicit scoped approval plus fresh server checks. An approval is bound to the displayed action/input/version, not an unlimited conversation consent. Automated policies require a separate bounded design and approval.

Never infer absence of allergens, organic status, origin/certification, shelf life, storage safety or medical suitability from a photo or missing field. Show unknowns and request seller evidence. Generated marketing cannot contradict structured product disclosures. Supplier facts and model suggestions remain distinguishable.

## Model and integration choices

The coding agent used to build Treido is separate from Treido's runtime AI. `astra-pro` is a branch name, not a verified API identifier. [OpenAI guidance](docs/agents/openai-guidance.md) records the checked current model guide. Select runtime models/providers by use-case evals, quality, cost, latency and applicable data controls; do not use the most expensive mode for every keystroke.

For OpenAI integration, consult current official Responses, tool-calling and structured-output documentation through the bundled docs skill/MCP. Verify the actual schema and installed SDK before implementation. No model slug, unsupported parameter, data-residency claim or account entitlement is inferred from the branch name.

## Evaluation and rollout

Before enabling a feature, create a small representative, versioned evaluation set of synthetic or authorized redacted cases. Cover BG/EN and long/ambiguous inputs, missing food facts, wrong units, hallucinated IDs, prompt injection, cross-tenant retrieval, revoked permissions, malformed output, duplicate action, provider timeout and quota exhaustion. For action tools, verify the real server boundary separately from model behavior.

Define measurable per-feature quality/latency/cost targets before interpreting results. Compare candidate prompt/model versions on the same held-out cases; manually review food/permission/consequential-action failures. Do not publish a score that masks a critical failure in an average. No arbitrary passing threshold is claimed here.

Enforce request/token/tool budgets, concurrency, cancellation and bounded retry. Supply useful unavailable/manual fallbacks. Roll out deliberately with observable failures and rollback. Core catalog, checkout, fulfillment and ordinary customer service continue when AI is disabled or failing.
