# Historical Astra documentation batch validation

Date: 2026-09-12. Repository: darkapoparka/treido-bg. Batch branch: astra-pro. Base application/source commit: 1d03706e84b5c19101246f2df42227bfddf78a54. This is the initial documentation batch's dated evidence, not the current session result or operating policy. It records documentation/tooling checks, NOT application, Shop acceptance or production qualification.

## Passed locally

| Check | Actual scope/result |
| --- | --- |
| node scripts/check-agent-docs.mjs | Relative links, skill frontmatter/uniqueness, root routing budget, 14 stable task headings, all 34 original requirement IDs and 12 immutable historical snapshots |
| python scripts/agent-skills.py --verify | Four pinned OpenAI skills, all 34 original files, hashes/inventory and retained licenses |
| node --check scripts/check-agent-docs.mjs | JavaScript syntax |
| Scoped Prettier check | New docs validation script, changed/new workflow files and generated metadata JSON passed |
| Existing workspace document-link test | One selected test passed; three unrelated tests were skipped by the explicit name filter, not claimed as passed |
| git diff --check and git diff --cached --check | Reviewed authored-file and staged checks; archived CRLF is recognized as a line ending and five byte-preserved upstream reference files retain original whitespace under explicit path attributes, with all source hashes verified |
| Project config parse | Python TOML parser accepted the docs-only MCP config; no model/permission/secret settings |
| Generated Next instruction block | Preserved exactly before the project-specific appendix |

Runtime used from the actual repository directory: Node v24.20.0 and pnpm 12.3.4. No dependency installation or application-stack upgrade was performed for this batch.

## Source and scope audit

The existing enumerator ran successfully: 97 flows, 424 frames, 175 reproducible definitions. This is recipe discovery only; no new visual acceptance, service proof or capture result. Detailed dated interpretation is in the root implementation map.

Application-path diff was limited to apps/web/AGENTS.md and apps/mobile/AGENTS.md. No application runtime, shared contract, existing test assertion, lockfile, Shop source byte or acceptance ledger was changed. The existing reference workflow now permits astra-pro as well as main without changing its diagnostic thresholds. The new documentation workflow is read-only and dependency-free apart from Node/Python.

## Not run or not established

No new full application lint/type/build/smoke run, source/live comparison, payment/database integration, native device build, AI evaluation or release was claimed. Existing application failures require their own exact-source checks. GitHub workflow results after publication are separate evidence, not inferred from local documentation checks.

Repo skill metadata and config files were checked; a fresh interactive Codex session's actual model availability, skill discovery and MCP connection were not asserted. Upstream skills are pinned source, not a security certification or proof of every external CLI prerequisite.

Mobbin's connector reported a paid-plan requirement. A fresh ordinary browser reached the requested URL/title but rendered public marketing/login content, not the Shopify version gallery. Zero Shopify reference assets were acquired; its manifest accurately retains unknown source totals. No access controls, credentials, private browser state or subscriptions were changed.
