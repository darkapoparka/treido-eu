# Treido shopping tools and assistants

September 30, 2026. Owns `GLOBAL-AI` and `GLOBAL-MINIS`. The owner requested useful shopping assistants in the existing Minis surface and the full web release. These are product contracts, not live model integrations. [API](api.md) owns tool boundaries; [categories](categories.md) owns valid constraints; [tasks](../tasks.md) owns delivery.

## What is preserved and changed

The source/current Mini catalogue includes guided gift selection, outfit/photo discovery, room ideas, beauty experiences and Sol voice entry. On September 30 the current `/minis` catalogue rendered and opening Gift Sense reached its sign-in boundary. Source inspection shows captured answer/product IDs and explicit unavailable flows. No authenticated original-Shop AI service or live model response was verified.

Keep the catalogue cards, detail sheet, input/permission pattern, shared result cards, focus, Back and recently-viewed behaviour. Product mode uses Treido identities/copy and real catalogue queries. Captured Shop Minis remain available only in explicit reference mode. The public product catalogue replaces medical/beauty analysis, third-party brands and recorded recommendations with the tools below. Retained URLs receive deliberate mappings/redirects; do not replace the whole navigation or install a second chat design system.

## Product catalogue

| ID / name                       | User job                                       | Inputs and concrete output                                                                                                          | Acceptance                                                                                                               |
| ------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `find-for-me` / Find for me     | Describe an item in ordinary Bulgarian/English | Text or editable voice transcript → visible category/condition/model/budget/location/seller constraints → matching real cards       | Every hard constraint respected; clarification for unsupported ambiguity; deterministic search remains available         |
| `deal-finder` / Deal Finder     | Find the cheapest suitable option              | Item/model, condition, budget, handover → ranked eligible offers with known item/shipping total and unknown-cost labels             | Cheapest means lowest known comparable total within the returned search scope, not an unsupported market-wide guarantee  |
| `compare` / Compare             | Decide between a short list                    | 2–4 real IDs → field-by-field price/condition/defects/attributes/fulfilment/seller table with sources and missing fields            | No invented specifications, warranties or inferred verification; withdrawn items cannot remain purchasable               |
| `photo-match` / Photo Match     | Find something visually similar                | Explicit uploaded photo → editable recognised type/colour/style → eligible listings and similarity explanation                      | No generated listing/product imagery masquerading as seller photos; unsupported recognition prompts editing              |
| `gift-finder` / Gift Finder     | Choose a gift without broad browsing           | Recipient interests, occasion, age range if useful, budget, condition/arrival needs → bounded real shortlist                        | Do not claim guaranteed arrival without fulfilment evidence; no sensitive profiling or invented stock                    |
| `compatibility` / Compatibility | Check a part/accessory against known equipment | Item/model/fitment constraints → cited seller/manufacturer facts and explicit unknowns                                              | A model guess is never a fit/safety guarantee; only structured supported evidence permits a positive compatibility claim |
| `sell-helper` / Sell Helper     | Create a better listing faster                 | Current seller's owned photos + seller facts → editable title/category/attributes/description and observed comparable asking prices | Seller confirms condition/defects/price; output saves only through ordinary authorised draft commands; no auto-publish   |

Voice is a mode of Find for me, not another catalogue truth source. Room/outfit discovery becomes a Photo Match preset using the same validated search and real items. Gift collections can use ordinary saved collections; no fake public registry service. Price insights use asking prices from our eligible comparable listings and explicitly disclose insufficient observations; they do not assert realised sales or external market value.

## Provider and runtime choice

The server adapter uses pinned Vercel AI SDK `ai@7.0.127` with AI Gateway for bounded structured text/photo generation and transcription. The existing feature commands, validated marketplace tools and durable run state remain the orchestration boundary. An OpenAI model is activated only through the intended account policy and Treido evaluation/cost/latency evidence. Keep the current Shop interaction shell instead of introducing provider-owned chat UI; model names, prices and account capabilities are checked against current provider facts.

The official [AI SDK agent reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent) supplies the reusable tool-loop pattern; [AI Gateway SDK/API guidance](https://vercel.com/docs/ai-gateway/sdks-and-apis) supplies routing options. Direct [OpenAI Agents SDK](https://developers.openai.com/api/docs/guides/agents/define-agents) is a supported alternative if later handoffs or OpenAI-specific capabilities justify it. Start with one orchestration stack and one server-owned tool contract. No reason exists to run two agent loops for every shopping query.

Gateway/provider credentials remain server-side. Local and hosted authentication must be qualified for the intended account/environment; declared account availability is not a working binding. The SDK transport captures exact Gateway generation metadata before validating output, disables automatic retries, bounds bytes/time/tokens, and preserves unknown charge reservations when authoritative reconciliation is unavailable. Transcription without exact supported generation correlation cannot be treated as free or settled.

Authentication defaults to the existing approved API-key fingerprint. Explicit hosted `vercel-oidc` mode rejects a configured API key and requires matching Vercel organization, project and environment plus pinned issuer/audience/subject. The SDK obtains fresh tokens; Treido verifies their signature and exact identity against the trusted issuer before a paid request. A new approved policy fingerprints that stable identity, never the rotating token. Usage reconciliation obtains a fresh token and keeps exact generation/model/provider/cost checks. OIDC availability does not authorize a model, processing terms or budget; those remain separate policy and evaluation requirements. See the [environment example](../app/apps/web/.env.example) for configuration names.

Usage reconciliation is independent of proposal success: authoritative terminal usage for the exact generation, model and provider can settle a billed truncated, filtered or failed response while that response remains unusable as shopping output. Unknown or mismatched evidence retains the reservation. Additive `0051_assistant_voice_usage` lets the existing scheduler and executor reconcile voice runs through the same consent, policy, job-lease and exact-generation checks; it does not authorize another inference call.

The execution route emits advisory progress followed by one validated final command acknowledgement. The browser validates frame order, actual bytes and UTF-8; cancellation/interrupted streams preserve the original durable request for recovery. Raw unvalidated model tokens are not rendered. Product-mode `/assistant` and `/minis/sol` map to Find for me, and `/minis/look` maps to Photo Match, retaining supported filters and the reference-only original rendering.

## Data and tool loop

1. Validate requested assistant, actor/ownership, body size and typed input. Reserve request budget atomically using human/request identity before a paid model call.
2. Translate natural language into a bounded schema. Show interpreted constraints for editing. User-selected seller scope/currency/category/price are hard constraints, preserved through refinement.
3. Tools call ordinary bounded marketplace queries with server-owned authority. Tools receive only necessary facts; public product text is untrusted content, never instructions or credentials.
4. Return real listing IDs plus explanatory text/structured fields. Server rechecks eligibility and constructs cards using current listing facts. The model cannot supply an arbitrary price, seller badge, href or HTML as authority.
5. Stream understandable progress/results into the existing answer surface. Cancel/timeout preserves the interpreted query and deterministic results. Reconcile actual usage against the same run, including interrupted calls.
6. Reviewable Save search / Save item / Use draft / Prepare message actions execute ordinary commands after the user selects them. Purchase, offer acceptance, publication, refunds and admin actions remain separate explicit product flows.

Public tools: `searchListings`, `getListingFacts`, `compareListings`, `getCategoryAttributes`, `estimateKnownTotal`, `getCompatibilityFacts`. Sell Helper receives authorised draft/media through a separate scoped tool. No arbitrary SQL, external URL crawling, browser control, system files, private conversations or payment/provider/admin tools.

[OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) supports schema-constrained data flow. Schema validation complements server eligibility and authority checks; a valid JSON response can still contain unsupported facts and must be grounded.

## Initial budgets and abuse controls

Development proposal: maximum 6 model/tool steps, 20 retrieved cards per search, 4 comparisons, 15-second text-run target and bounded input/output tokens; no unbounded recursive agent delegation. Initial signed-in human allowance is 20 assisted runs/day including voice/photo, plus a configured monetary ceiling per human/day and whole platform/day. Exact monetary caps/model selection are resolved from account limits and evaluated cost before activation. Anonymous users retain ordinary search.

Sellers share that human shopping budget. Sell Helper additionally enforces per-seller usage and current capability; business switching or multiple memberships cannot create unlimited human budget. Parallel requests reserve available budget atomically. Duplicate run keys return the same run; different input under a reused key conflicts. Budget exhaustion stops further model work and offers deterministic search/draft editing.

Rate-limit uploads, transcripts and generation independently. Moderation/eligibility applies to generated drafts and returned listings. Never run background paid searches without explicit saved-search consent and a bounded durable job budget. Promotions cannot buy their way into assistant factual reasoning; any sponsored recommendation is separately labelled and still satisfies hard constraints.

## Privacy, images and voice

Ask for photo/microphone use when invoked and explain purpose. Strip image metadata, validate actual bytes/dimensions, use private staged objects and a short documented retention period; uploaded room/outfit photos are not automatically published. Do not infer identity, medical conditions or sensitive characteristics. Photo recognition may suggest item facts, while condition/defects remain seller-confirmed.

Keep raw provider prompts/images/audio out of ordinary logs. Persist minimised run records, prompt/model/tool versions, listing references, cost/latency/outcome and explicit user feedback under reviewed retention. Delete/expire temporary media through owned lifecycle jobs. Voice uses a reviewed transcription adapter; transcript is editable and cancellation does not submit a purchase/message.

## Evaluation and release evidence

T15a creates a versioned BG/EN suite with at least 60 cases: 10 ordinary text/transliteration, 10 hard budget/model/seller/condition combinations, 10 multi-turn refinement/undo, 10 compare/total/compatibility missing-fact cases, 10 photo/gift/seller-draft cases and 10 adversarial/unavailable/budget/concurrency cases. Include several variants of “business-only used Sony under a budget” and deliberate prompt injection in listing descriptions.

Mandatory gates: zero fabricated IDs/prices/stock/claims; zero leaked private seller/message data; zero hard-filter violations; every listing-linked fact supported or labelled unknown; no unreviewed write; deterministic provider-failure recovery; durable budget/retry correctness. Record judged quality, measured latency/cost and eval dataset/model/tool versions. Numeric relevance targets follow representative fixtures plus human review rather than made-up success rates.

Run browser journeys for catalogue → inputs → edited constraints → results → listing → Back, denied permissions, cancelled uploads/voice, failed streaming and 320px/large-text layouts. A recorded Shop answer never counts as a Treido AI evaluation. Useful assistants belong to the full target; their completion still requires live isolated-provider evidence.
