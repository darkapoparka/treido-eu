# Working with AI agents

The project should remain understandable without a particular model or launcher. [AGENTS](../AGENTS.md) holds always-on rules; small skills route repeatable work; canonical docs hold the facts. Do not copy framework manuals or maintain parallel Luna/Codex/ChatGPT architecture files.

[Documentation ownership](documentation.md) maps current facts and update responsibilities. [UI patterns](ui-patterns.md) and [UI verification](ui-verification.md) provide the concrete design and acceptance contracts; the Shop buyer system is not interchangeable with Shopify-derived Studio.

## Session budget

Start with AGENTS, the next task, its exact files and the relevant one or two docs. Search/read additional context only for a specific uncertainty. Use current installed framework guidance for changed APIs. Do not re-audit the whole portfolio or load thousands of historical reference lines for a small feature.

For an implementation request, take the next ready task unless the owner named another. Inspect before editing and state the narrow outcome. Do not wait for a special “Phase 2” phrase. A blocked provider does not block pure domain code, contracts and isolated fixture tests, but those are not integration evidence.

## Task shape

Use the existing relevant task; small requested fixes need no new task ID, formal claim or separate receipt. Keep each change to a reviewable vertical slice or a behavior-preserving extraction. Aim for one main reason to change and one clear rollback. A numeric line/file limit is a warning, not a substitute for judgment. Split work when two unrelated risks would need different reviewers or rollback.

```text
Task: Txx / requirement IDs
Goal: one observable outcome
Scope: exact files/modules; explicit non-goals
Reference: BUY/STU pattern, presenter/CSS owner, inspected source/capture/admin state
Visible change: permitted difference and preserved surrounding composition
Dependencies: what must exist first
Acceptance: behavior + denial/failure case + visual requirement
Phone check: actual viewport, language, account/data, scroll, loaded fonts/images
Checks: commands and expected evidence
Result: changed files; PASS/FAIL/NOT RUN/BLOCKED for behavior/visual/provider/release
Next: one concrete action; unresolved decision only if it affects this task
```

Only `tasks.md` tracks active status. Longer receipts can go into a dated `docs/audit/` file with a link from the task. Avoid duplicate TODOs, giant progress diaries and stale “all complete” summaries.

## Reference-led feature execution

Implement behavior and appearance in the same slice. Before changing a frontend surface, the worker inspects its named [BUY/STU pattern](ui-patterns.md), existing Treido presenter/CSS owner and corresponding Shop source/capture or Shopify admin state. Include those references in the assignment. Start inside the existing owner, reusing its shell, typography, icons and interaction structure; apply only the documented Treido adaptations. Shop owns buyer and direct Sell flows; Shopify-derived patterns own Studio.

The worker returns the actual affected phone journey and a relevant failure/denial state alongside the implementation checks. The integrator reviews loaded rendered output, persistence/reload and the permitted visual difference before closing frontend acceptance. Use proportionate matched evidence under [UI verification](ui-verification.md), normally two to four useful captures. Source citations, unit tests and builds alone do not establish visual acceptance. Label historical captures and unavailable native references explicitly; an unavailable emulator does not authorize changing the surrounding visual system.

Keep a short current checkpoint at the top of `tasks.md`: what actually works, what remains unverified and the next named milestone. Link to the existing evidence instead of repeating long receipts. A fresh session starts there and assigns non-overlapping feature lanes; it does not create another task queue or re-audit the archive.

## Parallel work

Delegate only through tools actually available; do not claim a model name, subagent launch or increased reasoning setting without evidence. Assign non-overlapping file ownership and an agreed contract first. Keep one integrator for shared schemas, lockfiles, global styles and route composition. A worker returns a diff/summary plus test evidence; the integrator still reviews compatibility.

A frontend and backend task may proceed against the same agreed view model, but the frontend must label fixture behavior honestly. Never have two workers refactor the same stylesheet or generate competing seller models. Pause only conflicting files; preserve unrelated useful work. Re-read shared docs immediately before patching and compare with the inspected version. An unexpected change requires reconciliation, not overwriting. Keep an owned diff and compare the current content before shared-file writes. Use hashes or formal claims when actual overlap warrants them; release any such claim when finished.

## Review before completion

Inspect the diff for unintended style/DOM changes, reference leakage, private fields, client-trusted authority, broad caches, swallowed errors and weakened checks. Re-run proportionate tests and compare affected visual states. Confirm the tree contains no donor/environment/asset changes outside scope.

Mark `DONE` only when acceptance evidence exists. A missing check blocks completion only when required for the requested scope; record a pending integration/release separately from a completed local fix. Record what is not tested. Never describe a build, unit suite or local screenshot as a security or production certification.

## Skills and portability

Repo skills use standard `SKILL.md` front matter under `.agents/skills`. Codex's documented repository discovery searches this directory from the working directory toward the repository root; other launchers may require manual routing. Verify what the actual launcher loaded rather than assume. Root AGENTS explicitly names each skill as a fallback.

Keep four workflows initially: task execution, visual parity, Next/server-boundary work and backend/domain work. Add a skill only after repeated tasks expose a genuinely reusable procedure. Do not make a separate skill per feature or store secrets/tool permissions in skills.

References: [AGENTS discovery](https://developers.openai.com/codex/guides/agents-md), [local skills](https://developers.openai.com/codex/skills).
