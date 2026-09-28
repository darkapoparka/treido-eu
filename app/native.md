> **Donor/reference document retained on 27 September 2026.** This file records the original Shop/Foods source context, not this derivative's product requirements or current execution policy. Read [the product README](../README.md) and [current tasks](../tasks.md). Never follow an old source path or donor remote to perform work for Treido Global.

# Native buyer app

Owner: `apps/mobile`, Expo and React Native. This is the iOS/Android buyer product, not the seller dashboard or a second backend. NAT-001 through NAT-003 and the applicable buyer/account contracts are retained in [requirements](docs/product/requirements.md).

The current Shop reconstruction session targets the website. Native product implementation has not been demonstrated by that work. Do not equate an Expo scaffold, JavaScript export, browser screenshot or Expo Go session with an installed-app release.

## Shared meaning, native presentation

Consume the supported `/api/v1` contract owned by `apps/web`. Share client-safe schemas, identifiers, exact monetary/quantity semantics and approved tokens/messages when both clients actually use them. Do not share DOM components, server credentials, Prisma models, Next internals or a universal UI abstraction merely to avoid writing native composition.

Implement discovery, stores/products, cart, checkout, purchases, account and recovery against the same authoritative operations as web. Native may link to the responsive merchant dashboard with verified authentication/return behavior; that is not native merchant functionality.

## Required native behavior

Verify safe areas, platform back gestures/buttons, sheet stacking, keyboard avoidance, focus, text scaling, screen-reader labels and reduced motion. Inspect the exact source and record Android/iOS system differences rather than copying browser chrome or pretending a website is a native screenshot.

Test secure session persistence, account switching, expired sessions, cold/deep links, push destinations, background/resume, unreliable networks and interrupted provider returns. Cache private data by actor/business and clear it when context changes. Offline reads are labeled; no offline payment/order success is invented.

Payment outcomes come from reconciled server/provider truth. Native cannot calculate authoritative fees or mark an order paid after a redirect. Installed client versions may outlive the web deployment, so API compatibility and deliberate retirement are part of release planning.

## Verification and release

Use the pinned Expo-compatible dependency set and versioned docs in the nested AGENTS file. Validate on declared installed iOS/Android development builds and actual devices where required. A missing platform tool blocks that platform's evidence, not unrelated development.

Signing identities, privacy declarations, permissions, account deletion, provider configuration, store artifacts and separately authorized submissions are explicit release work. Never embed server secrets in `EXPO_PUBLIC_*` configuration. Store submission and store approval are separate outcomes.
