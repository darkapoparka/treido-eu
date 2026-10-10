---
name: treido-task
description: Use to start, continue, split, review or hand off work in Treido EU. Keeps one queue, limited context, explicit file ownership and evidence-based completion.
---
# Treido small-task workflow

1. Read root `AGENTS.md`, the relevant current claim/receipt and executable row in `tasks.md`, plus `docs/ai-workflow.md`. Use `docs/documentation.md` to load only the owning contracts. Select the named or next READY task; do not reopen source selection or load the whole historical queue.
2. Inspect the relevant Git diff, files, scripts and tests. Identify the outcome and focused checks. Use an existing task; small independent fixes need no new task registration, claim ledger or separate receipt.
3. Read only the owning specification and applicable workflow skill. Resolve API uncertainty from installed/official guidance; don't copy generic advice into another rule file.
4. Implement one useful slice. Split unrelated risks into child tasks in the same queue. Coordinate only actual overlapping files and shared Git/build operations; independent implementation may continue. Delegate only when useful and through available tools.
5. Review the diff for visual drift, private/reference leakage, client-trusted authority, weakened tests, broad caches and out-of-scope changes.
6. Run checks and label each PASS, FAIL, NOT RUN or BLOCKED with reason and evidence. Required unmet acceptance prevents DONE; preserve the useful partial work.
7. Update the relevant task for meaningful status changes and report results briefly; create detailed evidence only when its acceptance needs it. Stable decisions go to the decision register and their owning doc, not duplicate TODO files.

Never claim an unrun test, screenshot, worker, model configuration, deployment, commit or integration. A user's later build/continue request starts execution without another documentation approval loop.

For shared-file patches, re-read and compare the inspected version immediately before writing; stop on a concurrent change. Documentation changes run the product-doc check and its tests from `app/`, with owned diff review. Do not type-generate/build against active preview outputs just to validate Markdown. Release any overlapping-work claim when finished; ordinary independent edits do not require one.
