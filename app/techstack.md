> **Donor/reference document retained on 27 September 2026.** This file records the original Shop/Foods source context, not this derivative's product requirements or current execution policy. Read [the product README](../README.md) and [current tasks](../tasks.md). Never follow an old source path or donor remote to perform work for Treido Global.

# Stack and local commands

This is the installed foundation plus selected later integrations, not an instruction to upgrade or reinstall each session. Exact direct versions and the lockfile are authoritative; verify the executable actually used.

## Installed snapshot, audited 2026-09-12

| Area | Repository pin |
| --- | --- |
| Runtime/workspace | Node 24.20.0; pnpm 12.3.4; Turbo 2.10.12 |
| Language/tooling | TypeScript 6.0.3; ESLint 9.39.5; Prettier 3.9.6 |
| Browser | Next.js 16.3.4; React/React DOM 19.2.3; Tailwind/PostCSS 4.3.3 |
| Native | Expo 57.0.21; React Native 0.86.3; Expo Router 57.0.20; matching React |
| Existing tests/contracts | Vitest 5.0.0; Playwright 1.63.0; Zod 4.5.4 |

These are checked-in versions, not a claim that they are the latest registry releases or validated on every machine. Preserve the compatible Expo/React pair. Never force peer dependencies or update the lockfile during a styling/docs batch.

Read relevant installed Next documentation under `apps/web/node_modules/next/dist/docs/`. Native uses the exact SDK's documentation and Expo dependency checks. Existing global/plugin skills may be older or have different prerequisites; they do not override installed APIs.

## Commands already present

```sh
pnpm install --frozen-lockfile
pnpm dev:web
pnpm dev:mobile
pnpm --filter @treido/web lint
pnpm --filter @treido/web typecheck
pnpm test:unit
pnpm check
pnpm build:web
pnpm test:smoke:web
pnpm native:check
node scripts/check-agent-docs.mjs
python scripts/agent-skills.py --verify
```

Web's normal development port is 3100; Expo/Metro uses 8081. Reference parity uses the separately configured 6412 preview. Check listeners and their owning repository before starting/stopping anything. Do not run dev and build concurrently against the same `.next` output. The smoke harness owns its production server and requires its configured port free.

On the existing Windows host, the previously installed pinned Node runtime is `C:\Users\radev\.codex\tools\node-v24.20.0-win-x64`. Use a session-local PATH when needed; do not change global software as a side effect. Other machines should use the repository runtime/package-manager pins, not that machine-specific path.

`native:check` runs dependency/Doctor checks and iOS/Android JavaScript exports. It is NOT an OS build/device/store-release check. Do not invent missing future scripts or use `--if-present` to conceal mandatory tests.

## Selected, not yet implemented integrations

Neon PostgreSQL/Prisma owns the new isolated schema; Clerk provides identity; business permissions remain server-owned. Stripe handles separately designed marketplace payments and Premium billing. Vercel Blob, Resend/React Email, shared BG/EN messages, native query caching and deployed observability are selected for their actual feature tasks, not bulk installation now. Realtime/durable job providers remain DEC-005.

No Supabase migration, microservice rewrite, universal UI kit, speculative Redis/search service or full starter-template reset is part of the plan. Add a dependency only for a real task/consumer and verify compatibility/current official guidance then.

## Local Codex

Repository `.agents/skills/` and `.codex/config.toml` are documented in [Codex setup](docs/agents/codex.md). The project config adds only the public OpenAI documentation MCP endpoint; it does not set a guessed model ID, grant unrestricted tools, alter global settings or configure paid services. Upstream skills are pinned and their scripts/references/licenses are retained; use [the skill catalogue](docs/agents/skills.md).

## Environment boundaries

The provider-free reference foundation does not need live service credentials. Follow the existing explicit reference-mode flags, never a production environment shortcut. `NEXT_PUBLIC_*` and `EXPO_PUBLIC_*` values are extractable and cannot contain secrets. Missing integration configuration means unavailable capability, not fake success or fallback to another project's credentials.

Before migrations, sandbox provider writes, hosted previews, native cloud builds or other external actions, identify the actual authorized target and cost/permission boundary. Install/build must never seed or migrate data. Keep raw reference exports and private evidence ignored.
