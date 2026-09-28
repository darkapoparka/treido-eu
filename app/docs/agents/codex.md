# Local Codex setup and sessions

Use the existing `L:\CODEX\treido-bg` checkout for `darkapoparka/treido-bg`. [AGENTS.md](../../AGENTS.md) owns canonical `main`, optional existing `astra-pro`, the two-branch limit and one writer. [Product](../../product.md) owns the producer-first food destination; finish and approve Shop before adapting the same implementation.

## Synchronize the existing checkout

Inspect before switching, merging or starting overlapping UI work:

```sh
git status --short --branch
git remote -v
git branch -a -vv
git worktree list
git log --branches --not --remotes --oneline
git fetch origin --prune
git log --left-right --oneline origin/main...origin/astra-pro
git diff --stat origin/main...origin/astra-pro
git diff --stat origin/astra-pro...origin/main
```

Verify the remote and inspect unique commits and overlapping files, including local-only work. Preserve uncommitted work; never reset, clean, force-push or silently stash. A dirty checkout or divergent history needs inspection, not an automatic switch. Stop a command sequence on its first error.

For ordinary clean resumes on the existing canonical branch:

```sh
git switch main
git merge --ff-only origin/main
```

Integration is explicit work, not a setup side effect. Under the current owner authorization, synchronize the existing `astra-pro` with `--ff-only`, inspect `main`'s unique changes, and merge them into `astra-pro` with `git merge --no-ff --no-commit origin/main`. Review the merged diff, resolve conflicts by preserving intended behavior, run relevant checks, and commit. Switch the clean checkout to `main` and fast-forward it to that reviewed integration. If a fast-forward fails, inspect the new divergence; do not replace either tip or create another branch/worktree.

Fetch again before publication. Push explicit reviewed refs only when their remote tips are ancestors of the proposed local tips; use an atomic push when publishing both. Keep only `main` and `astra-pro`. Remove a superseded local branch with normal `git branch -d` only after its commits are contained in retained history and it is not checked out elsewhere. Inspect remote branches before deletion. Branch cleanup does not authorize deleting ignored reference media, local evidence or another session's files.

## Verify runtime and repository files

Use `.node-version`, the `package.json` packageManager pin and [techstack.md](../../techstack.md). Select an installed matching runtime with a session-local PATH; do not change global software or upgrade the stack to match it. On Windows, `py -3` is the available Python 3 launcher.

```powershell
node --version
pnpm --version
py -3 --version
node scripts/check-agent-docs.mjs
py -3 scripts/agent-skills.py --verify
```

Both checks use standard libraries. Install application dependencies with the frozen lockfile only when missing or inconsistent, after selecting the correct runtime. The docs check covers links, selected skill metadata, stable tasks/requirements and history; the upstream check covers pinned bytes/inventory/licenses. Neither proves skill discovery, MCP connectivity or application behavior.

All nine skills are already in Git. Do not run `--install` as a generic repair: with the existing lock it only verifies. Inspect missing/modified tracked paths and recover only understood missing content from the checked-out revision. Do not remove the lock to force downloads, edit the four pinned upstream directories or duplicate them globally.

## Verify the running Codex session

Read current `AGENTS.md`, `product.md`, `docs/STATUS.md`, the selected task and surface owner after synchronization. A branch switch does not prove the session's instruction chain refreshed; explicitly read changed instructions. Start a fresh session only if the client retains stale discovery or instructions that cannot be reconciled in the current task.

Confirm the actual session's skill catalogue exposes all nine names in [skills.md](skills.md), with paths under this checkout's `.agents/skills/`. Directory existence and validator passes are insufficient. CLI/IDE users can inspect `/skills` or the `$` selector; these are interactive controls, not shell commands. Same-named global/plugin skills remain separate; select the relevant resolved path and do not silently delete other installations. Codex detects skill changes automatically; restart if an update does not appear.

If a needed skill is absent, report the exact client limitation and read its checked-in workflow directly for independent work. Manual reading is not proof of automatic discovery.

## Verify the OpenAI documentation connection

[Project config](../../.codex/config.toml) contains the public `openaiDeveloperDocs` endpoint. Use normal client trust/approval controls when required; do not change global trust, sandbox or approval settings. Make a harmless search and fetch through the actual exposed server. A configured/listed server is not connected proof.

Where the standalone CLI is compatible, `codex mcp list` inspects its configuration; `/mcp` or client settings expose that client's status. A standalone CLI failure is separate from a successful desktop MCP request. Record its error/version and any required user action without printing credentials or copying client state into Git. Do not install a duplicate server or repair an optional CLI as a prerequisite for a working desktop connection.

Use [OpenAI guidance](openai-guidance.md) for current-source lookup and resolve bundled helpers from the selected skill's actual path. The optional docs service does not block independent Shop work using installed framework docs and checked-in references.

## Maintain skills and model guidance

Use the available `$skill-creator` for a demonstrated reusable workflow gap. Refine the relevant Treido skill; keep product requirements in their owners and prefer instructions when existing scripts suffice. Validate frontmatter, scope, paths and a representative use. Add a skill only when a distinct repeated workflow is missing; the creator is a client capability, not a tenth repository skill.

Use the Astra option actually exposed by the installed client/account. Branch names do not select a coding model or provision Treido's runtime AI. Do not force a guessed model slug or reasoning mode into project config. Current user instructions override skill guidelines; explain any actual skill requirement that blocks authorized work.

## Resume and record results

After setup, continue the next connected Shop mobile-web family through [single-session-execution.md](../../single-session-execution.md), using existing components, recipes and tests. Do not repeat setup after every edit or restart a documentation audit during ordinary UI work.

```text
Use L:\CODEX\treido-bg and darkapoparka/treido-bg. Read current AGENTS.md,
product.md and docs/STATUS.md, synchronize safely under the two-branch
policy, and continue the active Shop mobile-web task. Preserve both
branches' implementation, use the existing reference runner, and verify
visuals and interactions. Commit reviewed work and publish the integrated
result to main when fast-forward safe. Record exact evidence, remaining
issues and the next action in the existing owners.
```

[STATUS.md](../STATUS.md) holds one current setup/implementation result: source commit, actual runtime/checks, discovered skill paths, MCP request or limitation, flow/evidence, unresolved issue and next action. [Verification](../../verification.md) governs evidence. Old reports belong in [history](../history/README.md); source approval stays in the checklist and business decisions in their register.

Official sources checked 2026-09-12: [skills](https://developers.openai.com/codex/skills/), [AGENTS.md loading](https://developers.openai.com/codex/guides/agents-md/), [MCP](https://developers.openai.com/codex/mcp/), and [Astra instruction following](https://developers.openai.com/api/docs/guides/latest-model#gpt-6-astra-instruction-following). The branch procedure is Treido's owner-approved workflow, not an OpenAI requirement.
