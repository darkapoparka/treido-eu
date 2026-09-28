# OpenAI guidance adopted for Treido

Checked 2026-09-12 against official sources, including successful searches and fetched skills, AGENTS.md, MCP and Astra instruction-following pages through the running desktop's `openaiDeveloperDocs` connection. This is a curated adoption record, not an offline mirror or a guarantee of future API compatibility. Recheck affected guidance when changing integrations; do not refresh every link before each CSS edit.

## Coding behavior

The [Astra instruction-following guide](https://developers.openai.com/api/docs/guides/latest-model#gpt-6-astra-instruction-following) highlights sensitivity to unclear or conflicting guidance. Treido therefore has one short entry contract, explicit phase boundaries and task-relevant reading. Current user instructions take precedence over skill guidelines; an actual skill-imposed pause must identify its file and relevant instruction. `astra-pro` is an optional integration branch, not an API model slug. Coding-model selection and Treido's future runtime AI are separate decisions; project config forces neither a model nor reasoning default.

[Rethinking skills and prompts for GPT-6 Astra](https://learn.chatgpt.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra) motivates narrow skill triggers and less redundant instruction scaffolding. Our adaptation is to retain one writer, existing task IDs and the existing parity runner rather than create more lanes, plans or universal skills. Test scope follows changed risk; critical commerce/permission checks are not postponed.

[Codex best practices](https://developers.openai.com/codex/learn/best-practices/) informs outcome-focused tasks: goal, useful context, constraints and evidence of completion. Routine engineering choices are delegated; business/access decisions remain explicit. A task prompt is not a substitute for persisted repository state.

## Durable instruction surfaces

[AGENTS.md guidance](https://developers.openai.com/codex/guides/agents-md/) describes repository instructions and nested scope. `web.md`, `app.md` and the other contracts are not magically auto-loaded by their filenames; our AGENTS router tells the agent which to read.

[Skills guidance](https://developers.openai.com/codex/skills/) describes repo skills under `.agents/skills/`, with names/descriptions and task-specific loading. We keep a small discoverable set; references/scripts stay with the skill. Duplicate global/repo copies should be reviewed rather than assumed to merge.

[MCP guidance](https://developers.openai.com/codex/mcp/) and the [configuration reference](https://developers.openai.com/codex/config-reference/) support the project-scoped public docs endpoint. The checked-in config does not grant account authorization, install applications, set permissive sandbox policy or expose credentials. Trust and tool availability must be confirmed in the actual Codex session.

## Pinned OpenAI skill source

The owner-selected [openai-docs skill](https://github.com/openai/skills/blob/main/skills/.curated/openai-docs/SKILL.md) supplies current-document lookup and Codex manual routing. The selected upstream skills are pinned to `openai/skills` commit `49f948faa9258a0c61caceaf225e179651397431`, not a moving `main` download. [The catalogue](skills.md) and `upstream-skills.lock.json` record paths, hashes, licenses and installation evidence.

Read upstream instructions as scoped workflows, not permission to override Treido's current branch, globally install tools, deploy, alter approvals or bypass access restrictions. Invoke bundled helpers using their actual repository path. The docs skill prefers current official sources over bundled fallback snapshots; those snapshots are not forever-current model truth.

## API references to consult when implementing AI

The following are curated entry points, not a claim that their APIs are already installed or their full documentation was audited in this docs batch: [Responses](https://developers.openai.com/api/docs/guides/migrate-to-responses), [function calling](https://developers.openai.com/api/docs/guides/function-calling), [structured output](https://developers.openai.com/api/docs/guides/structured-outputs), [evaluation practice](https://developers.openai.com/api/docs/guides/evaluation-best-practices), [production practice](https://developers.openai.com/api/docs/guides/production-best-practices), and [data controls](https://developers.openai.com/api/docs/guides/your-data).

At implementation time, use docs MCP/official references to verify endpoint/schema/model support, SDK compatibility and the applicable privacy/retention settings. Treat prompts, tools, schemas and model versions as evaluated changes. Do not copy unrelated async, multi-agent, realtime, memory or caching features simply because a new model supports them. [ai.md](../../ai.md) owns Treido's product requirements and safety boundaries.

## Refresh discipline

Refresh the relevant source when its behavior is needed, a material incompatibility appears or the owner requests an upgrade. Review an upstream skill diff, license changes and prerequisites before updating its pin. Preserve hashes, run the skill/docs checks and commit a coherent change. Do not create a bot that silently updates guidance or dependencies.
