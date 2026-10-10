# Documentation ownership and agent entry

This map routes work; it is not a second task queue. The physical project is `L:/PLATFORMS/treido-eu-global`; package commands run from `app/`. Follow the current user task, root [AGENTS](../AGENTS.md), applicable nested instructions and the owning contract. Verify which instructions the actual launcher loaded; reading a file does not install a plugin or create a persistent agent.

## Read a small, sufficient context

Start with root AGENTS, the latest relevant claim/receipt and named executable task in [tasks](../tasks.md), then the one or two owning documents. Do not reload every historical receipt or reference archive for a small change. For visual work identify buyer versus Studio, read the matching [pattern](ui-patterns.md), then [verification](ui-verification.md). For real merchant integration also read [seller workspace](seller-workspace.md) and [backend](backend.md).

| Stable question | Owning document |
|---|---|
| What product, for whom, and what is in scope? | [platform](../platform.md), testable [PRD](../prd.md), [features](features.md) and [journeys](journeys.md) |
| What is implemented, blocked or next? | [tasks](../tasks.md), with dated evidence under docs/audit or private local artifacts |
| How must UI look, behave and evolve? | [styling](../styling.md) policy, [UI patterns](ui-patterns.md) implementation vocabulary, [UI verification](ui-verification.md) acceptance |
| Where does code live and who owns state? | [architecture](../architecture.md), [frontend](frontend.md), [backend](backend.md), [caching](caching.md) |
| How do public scope and private sellers differ? | [marketplace](marketplace.md), [seller workspace](seller-workspace.md), [data model](data-model.md), [API](api.md) |
| What are category, money, assistant and promotion rules? | [categories](categories.md), [billing](../billing.md), [assistants](assistants.md), [promotions](promotions.md) |
| Which versions/services and why? | [techstack](../techstack.md), dated dependency snapshot and [decisions](decisions.md) |
| What permits production release? | [testing](testing.md), [operations](operations.md), [launch](launch.md), completed owning task evidence |
| How should an agent execute and hand off? | Root/scoped AGENTS, four repo skills, [AI workflow](ai-workflow.md) |

README is a current entry point, not another architecture. PROJECT and design are compatibility pointers. Donor files under `app/` remain historical unless an active owner explicitly promotes a specific rule. Do not duplicate this plan into another model-specific agent directory or create `tasks-v2`, an unrelated TODO queue or a second product root.

## Update with the change, not months afterward

A rendered change updates its pattern only when the accepted reusable rule changes; a one-off screenshot observation belongs in the task receipt. An API/schema/authorization change updates its owning contract and denial tests. A dependency change updates manifest/lockfile, peer rationale and dated stack evidence together. A behavior change updates the relevant journey/feature acceptance, not every document mechanically.

Keep historical receipts dated and immutable in meaning. Add a newer result rather than rewriting an old failed test as passed. Correct obsolete present-tense claims at entry points. The October 1 requested deadline is historical; it does not prove a release occurred or remain a future promise. Authoritative status comes from current evidence.

## Reviewable claims and concurrent writers

Record exact file ownership in the existing task when another active writer overlaps. A small independent edit needs no new task or claim. Re-read a shared document immediately before a surgical patch; compare against the version actually inspected and stop on a conflicting change. Preserve other writers' completed receipts and dirty files. New source/config/lockfile changes need their own checks, even when accompanying a documentation task. Do not run broad formatting or type generation against a running preview's files.

Keep ordinary handoffs to the result, affected files, checks and material limitations. Include detailed revision/data-mode/visual/resource evidence when integration or release requires it; release an actual overlapping-work claim when finished. It does not say “everything finished” when mandatory checks remain blocked.

## Maintained documentation check

For documentation-only wording or workflow changes, review the affected text and links; no application tests, build or checker-test run is required. When document structure, relative links/anchors or executable task rows change, run `node scripts/check-product-docs.mjs` from `app/`. Run `node --test scripts/check-product-docs.test.mjs` when the checker itself changes, rather than after every Markdown edit. The checker covers current root documents, direct owning docs, scoped agent instructions and four repo skills; relative file links/anchors, repository confinement, executable task rows and agent routing. Historical donor documents are not silently promoted to current authority. External URL availability and private evidence contents are outside this offline check.

Documentation-only pushes and pull requests skip application CI. Code and configuration changes, and manual workflow runs, retain the documentation check before package installation and the existing application checks. A local checker pass is documentation evidence only; an unpushed workflow has not run on GitHub. It cannot enforce visual quality by itself or replace application/database/provider tests. Existing CI security and production-reference gates remain mandatory for code and release changes.
