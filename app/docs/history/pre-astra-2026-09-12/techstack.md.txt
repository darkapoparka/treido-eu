# Technology stack and installation

[product.md](product.md) defines what to build. [architecture.md](architecture.md) defines ownership. [tasks.md](tasks.md) supplies numbered assignments. This document is setup guidance, not another backlog. Tools are selected but not installed/verified until Task 1 and the relevant later batches record results.

## 1. Selected tools

| Area | Choice | Boundary |
| --- | --- | --- |
| Workspace | pnpm workspaces + Turborepo | Official Next.js/Expo starters; packages for real shared consumers. No full next-forge scaffold. |
| Runtime/types | Supported Node.js LTS + strict TypeScript | Resolve mutually compatible versions once in Task 1, then pin. |
| Browser | Next.js App Router + React | Complete marketplace/account/merchant/admin platform and backend in apps/web. |
| Native | Expo + React Native + Expo Router | Buyer app in apps/mobile; platform-specific UI and actual installed-build verification. |
| Web styling | Tailwind + selected shadcn/ui primitives | Shop-matched components, no generic theme or bulk overwrite install. |
| Native styling | React Native StyleSheet + shared tokens | Supported gesture/animation packages only where the source flow needs them. |
| Contracts | Zod + TypeScript | Client-safe inputs/DTOs/errors, not Prisma model exports. |
| Database | Neon PostgreSQL + Prisma | New product-led schema, real constraints, isolated synthetic data. |
| Identity | Clerk web and Expo SDKs | Sessions/identity; business/resource authorization remains on the server. |
| Payments | Stripe | Marketplace and Premium are distinct; product DEC-002 defines money behavior. |
| Files/email | Vercel Blob + Resend/React Email | Public versus private access and safe non-production delivery. |
| Localization | next-international on web; shared plain BG/EN messages | Verify compatibility; native never imports Next-specific localization. |
| Remote native state | TanStack Query when real API work begins | Actor/business-scoped keys, clear private data on context changes. |
| Forms | Accessible controls + server validation | React Hook Form only for justified complex editors. |
| Tests | Vitest, PostgreSQL integration, Playwright | Compatible Expo/Jest + React Native Testing Library as needed; Maestro/device tooling for installed-app journeys. |
| Lint/format | ESLint flat config + Prettier | Supported Next/Expo rules, one formatter. |
| CI/build/hosting | GitHub Actions, Vercel, Expo tooling/EAS | No implicit production deployment or paid cloud build authorization. |
| Observability | Sanitized logs; Sentry on deployed web/native | No personal-data replay by default or overlapping collectors without need. |

Use relevant installed skills/plugins and official CLI help/documentation. Do not install every provider during Task 1. Realtime and durable-work services are selected for their actual feature under DEC-005; Ably/Inngest are candidates, not defaults to install. No speculative Redis/search cluster/NestJS/GraphQL/separate API deployment or universal web/native UI.

## 2. Compatibility and reproducibility

Task 1 selects a supported Expo SDK and its React Native/React requirements first, then a compatible stable Next.js/React pair, Node LTS, pnpm, TypeScript and tooling. Use official package metadata and Expo checks rather than guessing or copying another project's lockfile. Prefer a shared compatible React version; any separate versions need verified isolation and one React instance per app. Never force Expo onto web's preferred version.

Pin direct dependencies initially and commit one pnpm-lock.yaml, packageManager, Node version and workspace config. Prefer supported starter/Metro/pnpm defaults. Add hoisting or resolver workarounds only for a reproduced documented issue. Resolve incompatibilities; do not suppress peer warnings with force flags. Upgrades are reviewable work, not part of a routine styling batch.

| Component | Actual version | Evidence owner |
| --- | --- | --- |
| Node / pnpm / Turbo / TypeScript | 24.20.0 / 12.3.4 / 2.10.12 / 6.0.3 | Task 1 |
| Next.js / React / React DOM | 16.3.4 / 19.2.3 / 19.2.3 | Task 1 |
| Expo / React Native / React / Expo Router | 57.0.21 / 0.86.3 / 19.2.3 / 57.0.20 | Task 1 |
| Styling / validation / lint / initial tests | Tailwind/PostCSS 4.3.3; Zod 4.5.4; ESLint 9.39.5; Prettier 3.9.6; Vitest 5.0.0; Playwright 1.63.0 | Task 1; shadcn deferred until a reference-measured primitive needs it |
| Prisma CLI/client/adapter / Clerk / localization / native query | Not installed | Task 4 or the first actual consumer |
| Payment / files / delivery / billing / AI tools | Not installed | Their implementing numbered tasks |

Versions resolved on 2026-09-08 from official package metadata. [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) determines the shared React/RN pair. Next 16.3.4 supports that React version. TypeScript 7 and ESLint 10 were deliberately not selected: typescript-eslint 8.70.0 supports TypeScript below 6.1, and the React/import/accessibility ESLint plugins still require ESLint 9. ESLint 9 is the compatible maintenance line and carries an upstream deprecation notice. Direct dependencies are exact; pnpm-lock.yaml owns the complete graph.

Expo's installer selected Reanimated 4.5.1, Worklets 0.10.1 and Gesture Handler 2.32.0 to satisfy Router's transitive native requirements; these are not product animation implementations. @react-native/metro-config 0.86.3 satisfies the matching RN CLI peer. No hoisting, Metro resolver override or suppressed peer check was added. Expo config/doctor is 57.0.2 / 1.20.4. pnpm's generated exact release-age exceptions cover the selected current framework/tooling packages; only unrs-resolver's required native-resolver postinstall is allowed. No arbitrary dependency build scripts are enabled.

### Verified setup and local commands

Use Node 24.20.0 (`.node-version` / `.nvmrc`) and pnpm 12.3.4. On this Windows host, a portable Node runtime was installed at `C:\Users\radev\.codex\tools\node-v24.20.0-win-x64`; the system Node installation was not changed. To use it in PowerShell:

```powershell
$env:Path = 'C:\Users\radev\.codex\tools\node-v24.20.0-win-x64;' + $env:Path
```

`pnpm --version` should report 12.3.4 through the packageManager pin. On a machine without pnpm, bootstrap with `npm install --global pnpm@12.3.4`, or use `npx --yes pnpm@12.3.4` for the commands below.

```sh
pnpm install --frozen-lockfile
pnpm dev:web          # http://localhost:3100
pnpm dev:mobile       # Expo/Metro on 8081
pnpm check            # lint, code/config formatting, types, unit/import/doc-link tests
pnpm build:web
pnpm start:web        # production build on http://127.0.0.1:3100
pnpm exec playwright install chromium
pnpm test:smoke:web   # starts/stops its own production server; port 3100 must be free
pnpm native:check     # dependency check, Doctor, then iOS + Android JS exports
```

For installed Chrome on Windows, set `$env:PLAYWRIGHT_CHANNEL='chrome'` before `pnpm test:smoke:web`; CI installs Chromium explicitly. Stop web dev/start before a production build or smoke test. The smoke harness refuses to reuse an unknown listener. Shared contracts have real consumers in both clients; tests verify one React instance and Router/native module resolution. Formatting owns code/config; existing Markdown prose is preserved and owning-document relative links are tested.

The provider-free bootstrap needs no environment values. Each app includes a safe `.env.example`. Task 4 will introduce and validate the actual API origin; physical devices require a reachable LAN/HTTPS address, Android emulators commonly use `10.0.2.2` for the host. No native API calls exist yet. `pnpm --filter @treido/mobile android` opens an available Android emulator/device; the `ios` script requires an iOS simulator on macOS. Exports are under `apps/mobile/dist/ios` and `apps/mobile/dist/android` and are ignored. No native OS build/device acceptance is claimed.

Official generators used (host pnpm 11.24.0 before the project pin was established):

```sh
pnpm dlx create-next-app@16.3.4 apps/web --ts --tailwind --eslint --app --src-dir --import-alias '@/*' --use-pnpm --skip-install --disable-git --empty --yes
pnpm dlx create-expo-app@4.0.0 apps/mobile --template default@sdk-57 --no-install --yes
pnpm --filter @treido/mobile exec expo install react-native-reanimated react-native-worklets react-native-gesture-handler --pnpm
```

Starter demo modules/assets were removed from app source and retained only in ignored local storage. No Shop assets or product styling were introduced; design tokens and shadcn components wait for Task 3's actual measured consumers.

### Agent documentation and skills

[Official Next.js skills](https://github.com/vercel/next.js/tree/canary/skills) now live with the framework. Installed globally for this Codex host: `next-dev-loop`, `next-cache-components-adoption`, and `next-cache-components-optimizer`. They are discoverable on subsequent turns. Their upstream source uses the canary branch, so each skill's version prerequisites still matter; the app itself uses stable Next 16.3.4. Existing plugin-cache files were preserved.

[Next.js agent guidance](https://nextjs.org/docs/app/guides/ai-agents) now favors bundled, version-matched docs over the retired standalone `next-best-practices` skill. `apps/web/AGENTS.md` points to `node_modules/next/dist/docs/`; root AGENTS requires it for every Next task. The generated native AGENTS points to SDK 57. No connected framework runtime MCP was assumed; official docs and registry metadata were available. Runtime `/_next/mcp` can be used with `next dev` in later feature work. Agent-browser 0.37.1 was available through pinned pnpm dlx for local browser inspection.

The older installed cache skill contains legacy examples: use the installed docs for `revalidateTag(tag, "max")` stale-while-revalidate semantics and experimental/private-cache restrictions. Cache Components are not enabled just for a static bootstrap. Skills support verification; they do not guarantee perfect software.

## 3. Installation by work package

**Task 1:** Inspect the checkout and concurrent work. Use create-next-app and create-expo-app in their app directories, preserving root docs and avoiding nested Git repos. Use private manifests, workspace:* dependencies and explicit exports. Add contracts/tokens only with smoke consumers and shared messages when used. Configure strict types, lint/format, minimal CI, meaningful imports/tests, ignores and placeholder env examples. Use a neutral marked provider-free shell; do not invent Shop values or claim working commerce. Document available local ports and device origin conventions. Install needed shadcn primitives with its CLI, not all components. Run the Task 1 closing checks after the coherent scaffold, not after each generated file.

**Task 4:** Use an explicitly authorized fresh development PostgreSQL target and synthetic data; no old schema or data import. Verify project/database/branch and effective roles before writes. Configure one server Prisma client and supported Node/PostgreSQL adapter, runtime/migration connection conventions and explicit env loading. Schema/migrations live in apps/web/prisma. Configure Clerk development identity and secure native token persistence, implement/test context API before the catalog work, and connect real client consumers. Establish the PostgreSQL/browser harness and actual native development-build verification within this batch. Provider/environment setup does not require the old repository.

**Tasks 5 and 8-11:** Install integrations when their implemented feature requires them. Use sandbox/sinks and current relevant skills. Decide and verify background replay at the payment batch, not only at notification work. Later communication extends that foundation. Task 12 runs comprehensive regression; Tasks 13-14 prepare/execute separately authorized release.

A local fixture shell requires no billable provisioning. Access/linking to Vercel, Neon, Clerk or Expo must target the authorized environment. Do not enable public production from main or run paid EAS builds as a side effect of installing dependencies.

## 4. Script contract

Implement real scripts with their owning task, not placeholders that pass because nothing runs. Use package scripts and existing tools; small portable Node glue only when necessary. Support Windows/macOS/Linux without a custom orchestration framework. Scoped scripts/filters can run during development; full checks run at the task checkpoints, not after every small edit.

| Owner | Script | Meaning |
| --- | --- | --- |
| Task 1 | pnpm dev:web / pnpm dev:mobile | Start only the selected application; document ports and device API origin. |
| Task 1 | pnpm build:web | Production web build, no mutations or deployment. |
| Task 1 | pnpm lint / pnpm format:check / pnpm format | Checks versus explicit formatting write. |
| Task 1 | pnpm typecheck / pnpm test:unit | Existing workspaces and meaningful implemented unit/contract tests. |
| Task 1 | pnpm native:check | Expo doctor/dependency checks and iOS/Android JS exports; not OS compilation. |
| Task 1 | pnpm check | Implemented lint/format/types/unit/import/doc-reference checks; not release acceptance. |
| Tasks 3-4/6 | pnpm test:e2e:web / pnpm test:visual | Built-web journeys and approved deterministic baselines once available; no auto-update. |
| Task 4 | pnpm db:generate / pnpm db:validate | Prisma client/schema checks, no data writes. |
| Task 4 | pnpm db:migrate:dev / pnpm db:migrate:deploy | Forward migrations on explicitly authorized targets, never during install/build. |
| Task 4 | pnpm db:seed:test / pnpm test:integration | Synthetic seed/real PostgreSQL tests against verified disposable targets. |
| Tasks 4-6 | pnpm test:e2e:mobile | Declared installed-app/device journeys when implemented; missing platform tools are explicit. |

Absent future suites remain not implemented, not fake green scripts. Do not use --if-present, continue-on-error or empty suites to conceal missing mandatory checks. Install/check early primitives with focused tests; wait for approved source captures before declaring a visual baseline.

Keep database writes/deployments/cloud builds opt-in and noncached. Declare Turbo outputs and environment inputs correctly; never cache sensitive logs/provider payloads. Avoid concurrent dev/build against the same .next output and serialize shared lockfile/schema generation.

## 5. Environment safety

Web secrets stay in local/hosted secret stores; native configuration contains public values only. Templates contain names/placeholders. NEXT_PUBLIC_* and EXPO_PUBLIC_* values are extractable: no server tokens or DB credentials there.

Validate environments and enabled capabilities. Missing configuration explains unavailable behavior, never simulates success or selects another project's live credentials. Real integration errors cannot trigger mock fallbacks. Mark isolated fixture/reference mode, exclude it from release, and test that it cannot send real payments/emails or write production data.

Separate runtime/migration/test/operator credentials; an APP_ENV label alone does not prove the destination or privilege. Installation does not authorize data import, production changes, domains, paid services or store submission.

## 6. Official references

Use version-matched guidance: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [AI agents](https://nextjs.org/docs/app/guides/ai-agents), [Expo monorepos](https://docs.expo.dev/guides/monorepos/), [Expo Router](https://docs.expo.dev/router/introduction/), [development builds](https://docs.expo.dev/develop/development-builds/introduction/), [Turborepo Next.js](https://turborepo.dev/docs/guides/frameworks/nextjs), [Clerk Expo](https://clerk.com/docs/expo/getting-started/quickstart), [next-international](https://next-international.vercel.app/docs/app-setup), [shadcn](https://ui.shadcn.com/docs), [Neon docs](https://neon.com/docs/llms.txt), [Prisma transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions), [Stripe Connect](https://docs.stripe.com/connect/charges), [Next.js tests](https://nextjs.org/docs/app/guides/testing/vitest), [Playwright](https://playwright.dev/docs/test-snapshots).
