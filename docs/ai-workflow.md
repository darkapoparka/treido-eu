# Working with AI agents

The project should remain understandable without a particular model or launcher. [AGENTS](../AGENTS.md) holds always-on rules; small skills route repeatable work; canonical docs hold the facts. Do not copy framework manuals or maintain parallel Luna/Codex/ChatGPT architecture files.

[Documentation ownership](documentation.md) maps current facts and update responsibilities. [UI patterns](ui-patterns.md) and [UI verification](ui-verification.md) provide the concrete design and acceptance contracts; the Shop buyer system is not interchangeable with Shopify-derived Studio.

## Session budget

Start with AGENTS, the next task, its exact files and the relevant one or two docs. Search/read additional context only for a specific uncertainty. Use current installed framework guidance for changed APIs. Do not re-audit the whole portfolio or load thousands of historical reference lines for a small feature.

For an implementation request, take the next ready task unless the owner named another. Inspect before editing and state the narrow outcome. Do not wait for a special “Phase 2” phrase. A blocked provider does not block pure domain code, contracts and isolated fixture tests, but those are not integration evidence.

## Task shape

Keep each change to a reviewable vertical slice or a behavior-preserving extraction. Aim for one main reason to change and one clear rollback. A numeric line/file limit is a warning, not a substitute for judgment. Split work when two unrelated risks would need different reviewers or rollback.

```text
Task: Txx / requirement IDs
Goal: one observable outcome
Scope: exact files/modules; explicit non-goals
Dependencies: what must exist first
Acceptance: behavior + denial/failure case + visual requirement
Checks: commands and expected evidence
Result: changed files; PASS/FAIL/NOT RUN/BLOCKED with reasons
Next: one concrete action; unresolved decision only if it affects this task
```

Only `tasks.md` tracks active status. Longer receipts can go into a dated `docs/audit/` file with a link from the task. Avoid duplicate TODOs, giant progress diaries and stale “all complete” summaries.

## Parallel work

Delegate only through tools actually available; do not claim a model name, subagent launch or increased reasoning setting without evidence. Assign non-overlapping file ownership and an agreed contract first. Keep one integrator for shared schemas, lockfiles, global styles and route composition. A worker returns a diff/summary plus test evidence; the integrator still reviews compatibility.

A frontend and backend task may proceed against the same agreed view model, but the frontend must label fixture behavior honestly. Never have two workers refactor the same stylesheet or generate competing seller models. Pause only conflicting files; preserve unrelated useful work. Re-read shared docs immediately before patching and compare with the inspected version. An unexpected change requires reconciliation, not overwriting. Keep before-state hashes and a precise owned diff; release the claim with the receipt.

## Review before completion

Inspect the diff for unintended style/DOM changes, reference leakage, private fields, client-trusted authority, broad caches, swallowed errors and weakened checks. Re-run proportionate tests and compare affected visual states. Confirm the tree contains no donor/environment/asset changes outside scope.

Mark `DONE` only when acceptance evidence exists. A code change with blocked mandatory verification stays `BLOCKED` or `IN_PROGRESS`, with exact recovery instructions. Record what is not tested. Never describe a build, unit suite or local screenshot as a security or production certification.

## Skills and portability

Repo skills use standard `SKILL.md` front matter under `.agents/skills`. Codex's documented repository discovery searches this directory from the working directory toward the repository root; other launchers may require manual routing. Verify what the actual launcher loaded rather than assume. Root AGENTS explicitly names each skill as a fallback.

Keep four workflows initially: task execution, visual parity, Next/server-boundary work and backend/domain work. Add a skill only after repeated tasks expose a genuinely reusable procedure. Do not make a separate skill per feature or store secrets/tool permissions in skills.

References: [AGENTS discovery](https://developers.openai.com/codex/guides/agents-md), [local skills](https://developers.openai.com/codex/skills).
