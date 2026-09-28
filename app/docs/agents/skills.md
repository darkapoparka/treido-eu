# Skill catalogue

Repo discovery root: `.agents/skills/`. Load only the skill relevant to the requested workflow. Nine skills are bundled: four selected upstream OpenAI skills and five small Treido workflows. This is deliberately not an installation of every unrelated framework/deployment skill.

**Already in Git:** the integrated checkout contains these skills. Follow [local setup](codex.md) to verify them and the actual client; no additional global skill installation is required. Skills support the producer-first product contracts, not the other way around.

## Pinned upstream skills

Source: `openai/skills` commit `49f948faa9258a0c61caceaf225e179651397431`, selected from `skills/.curated/`. Complete selected directories are retained, including their original scripts, reference material, metadata, assets and licenses. The 34 files were fetched and checked against the upstream Git blob hashes; SHA-256 inventory lives in [upstream-skills.lock.json](upstream-skills.lock.json). No downloaded script is executed by the importer.

| Skill | Use for | Boundary |
| --- | --- | --- |
| `openai-docs` | Current OpenAI documentation, Codex/manual questions, model/prompt migration guidance | Prefer current sources; use its actual repo-local script paths; do not infer account/model access |
| `gh-fix-ci` | Requested GitHub Actions failure diagnosis and focused fixes | Existing connector/CLI authorization required; no weakened tests, branch changes or deployment |
| `security-threat-model` | Explicit repository/feature threat modeling | Scope to the actual product and authorized data; not a mandatory full audit per edit |
| `security-best-practices` | Requested security review or sensitive implementation guidance | Load only relevant language/framework references; installed APIs and Treido authority boundaries still apply |

These are upstream snapshots, not security certification or proof that every external CLI prerequisite is installed. Global/repo copies with identical names may conflict. Preserve the original upstream bytes and license; place project-specific interpretation in this catalogue and the root contract, not untracked edits to vendored files. Do not replace pinned files with whatever upstream main supplies during routine setup.

## Treido workflows

| Skill | Use for |
| --- | --- |
| `treido-shop-parity` | Frozen source -> canonical implementation -> connected interactions -> measured evidence |
| `treido-food-commerce` | Producer/food experience, catalog/quantities, stock, checkout and recovery |
| `treido-merchant-cms` | Real seller operations and draft/preview/publish/version/rollback |
| `treido-ai-quality` | Grounded AI features, permissioned tools and versioned evaluations |
| `treido-session` | Handoff and current-doc/task/evidence reconciliation |

The root agent contract already routes ordinary work; the session skill is not an instruction to conduct another whole-project audit. Do not invoke all nine for every task. Use the existing product and surface docs for intent and requirements; do not duplicate them inside a giant skill.

## Creation is different from installation

Use the available `$skill-creator` only to refine a concrete repeatable workflow gap, normally in one of our five Treido skills. It is not a startup dependency. The expected inventory remains nine unless an intentional reviewed change updates it. Built-in creator/installer tools are client capabilities, not additional repository skills counted by our guard.

The local setup guide owns discovery and troubleshooting. Avoid a parallel plugin/installer structure solely to distribute files already checked into this one repo. Broader distribution can be considered separately when it has an actual consumer.

## Deliberately optional

The upstream `playwright` skill was inspected but is not installed here: it prescribes a separate CLI-first workflow and global-style paths, while Treido already has a project-owned Playwright capture/journey runner. Use that runner for reproducible evidence and an available browser tool for ad hoc authorized inspection; do not install a second pipeline during setup.

Deployment/auto-PR skills, Figma-only workflows, unrelated language frameworks, document/PDF/notebook/media tools and third-party ticket/workspace integrations are not blanket prerequisites. Add a specific skill only when a real task benefits, source/license/prerequisites are reviewed and its scope does not conflict.

## Verify or refresh

```sh
python scripts/agent-skills.py --verify
node scripts/check-agent-docs.mjs
```

`--verify` is offline and checks upstream bytes, inventory and licenses. `--install` is the original initial-import operation: when the lock already exists it calls verify and returns. It does NOT redownload or repair missing managed files. A complete normal checkout needs neither installation nor network access for these checks. Inspect a missing/modified tracked path before recovering it from Git; preserve local work. Do not delete the lock or managed folders to force an import.

For an intentional upgrade, review the source commit diff and licenses, stage the new managed files explicitly, update the pin/lock coherently and rerun both checks. Do not modify the global Codex skill directory or execute a downloaded helper without checking its purpose. Python bytecode/cache files are not part of the upstream inventory and must stay out of public source.

[Initial documentation batch validation](../history/2026-09-12-astra-setup.md) is historical evidence. [Current status](../STATUS.md) records the latest setup and implementation checkpoint; neither a filesystem check nor a green docs workflow proves client-side discovery or application completion.
