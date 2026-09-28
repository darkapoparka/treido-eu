# Documentation map

The root agent contract is a router, not a book to reload every turn. Each new session reads the product destination and current status once, then opens the owner for its task and the precise supporting sections needed. Product contracts define what users can do; skills help execute them and never replace them.

| Question | Single current owner |
| --- | --- |
| Where are we, on which branch, and what resumes next? | [STATUS.md](STATUS.md) |
| What work package should execute? | [tasks.md](../tasks.md) |
| What are we building, for whom, and why? | [product.md](../product.md) |
| How does the manufacturer-and-products homepage work? | [web.md](../web.md) |
| What does each other surface do? | [Native](../native.md), [seller/CMS](../app.md), [admin](../admin.md) |
| What exact food/commercial requirements must survive? | [Detailed requirements](product/requirements.md) |
| Which policy values are still proposals? | [Decisions](product/decisions.md) |
| What owns data and permissions? | [Architecture](../architecture.md), [engineering detail](engineering/architecture-detail.md) |
| How does the reference become working UI? | [Design](../design.md), [Shop execution](../single-session-execution.md) |
| What is measured/accepted? | [Implementation map](../shop-implementation-map.md), [frame ledger](../shop-frame-ledger.md), [flow checklist](../shop-parity-checklist.md) |
| How do we style and then adapt to food? | [Style guide](../style-guide.md) |
| What is the seller design source? | [Shopify acquisition record](../shopify/README.md) |
| What useful AI features are in scope? | [AI product contract](../ai.md) |
| How do we verify or release? | [Verification](../verification.md), [detailed acceptance](engineering/verification-detail.md) |
| How should local Codex use skills and current docs? | [Codex setup](agents/codex.md), [skills](agents/skills.md), [OpenAI sources](agents/openai-guidance.md) |
| What was preserved from the earlier approach? | [History](history/README.md) |

`web.md` means the buyer website; `app.md` means the merchant operating product, NOT a folder or native application. `native.md` removes that ambiguity. `product.md` is the platform overview; do not add a competing platform/end-goal document that repeats it.

## Retire obsolete guidance, do not accumulate it

During an authorized documentation change, update the existing owner. When another active guide is obsolete or duplicated, inspect its inbound links and unique requirements/evidence, move still-current material to the correct owner, update consumers, then delete the superseded active Markdown in the same coherent batch. Do not merely prepend another conflicting instruction to every file, leave `old`/`v2`/backup Markdown beside the current contract, or make an agent infer which plan wins.

Preserve dated evidence only when useful, clearly outside current execution policy. The existing immutable snapshots in `docs/history/` remain intact and are not startup reading. Git history preserves removed redirect stubs; they need no additional backup documents. A historical reference or requirement ID is not permission to revive an obsolete execution mode.

| Material | Disposition |
| --- | --- |
| `parallel-execution.md`, `parallel-prompts.md` | Deleted from the active tree on 2026-09-12; current branch/session instructions belong to AGENTS.md and single-session-execution.md |
| `docs/parity/lane-a-account.md`, `docs/parity/lane-b-commerce.md`, `docs/parity/lane-c-discovery.md` | Deleted retired lane redirects; source families/acceptance remain in the existing Shop ledgers, not separate writer queues |
| Current root and nested agent/surface contracts | Keep and revise at their owner; do not delete framework-generated instruction blocks |
| Source manifests, frame/flow ledgers, measurements and task evidence | Preserve identities and evidence; regenerate only through the owning process, never reset as documentation cleanup |
| Pinned upstream skills, scripts and licenses | Preserve verified bytes; refresh deliberately through their existing source/lock process, not a recursive Markdown rewrite |
| Historical snapshots | Keep inert and integrity-checked; never use them as current instructions |

Deletion is file-specific, not `delete all *.md`. Keep all required product behaviors and numerical policy examples. Do not delete an unresolved decision, missing test or unfinished source flow to make the documentation look complete. Fix current references and run `node scripts/check-agent-docs.mjs`; run `python scripts/agent-skills.py --verify` when skill integrity is relevant. These are structural checks, not proof that the product is perfect.

## Evidence and scope

Specifications say what must exist; status and evidence say what actually exists. A source link is not a downloaded screen, a replay is not visual acceptance, and an approved screenshot is not working payments. Keep these distinctions in updates.

[The initial documentation batch validation](history/2026-09-12-astra-setup.md) is archived with its original scope. The current implementation map links older measurements to the immutable archive instead of repeating them as open instructions. [STATUS.md](STATUS.md) owns the latest setup result and resume action.
