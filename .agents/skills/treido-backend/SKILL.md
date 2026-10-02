---
name: treido-backend
description: Use for Treido identity, seller ownership, listings, uploads, search queries, messaging, database, jobs, entitlements or payments. Not permission to provision or change production services.
---
# Treido backend workflow

1. Read active task, `docs/backend.md`, `docs/marketplace.md`, and `billing.md` only for financial/entitlement work.
2. Inspect existing contracts/schema/providers. State the actor, resource owner, allowed transition and failure/retry cases. Browse scope is never operating permission.
3. Implement a small server-only use case: validate bounded input, verify session and current membership/resource authority, apply an atomic database command, return a minimal result.
4. Protect constraints and races in the database. Keep one transaction connection and consistent lock order. External provider calls happen outside locks with durable, replay-safe intent.
5. Scope media/private data and cache access. Never trust browser price, stock, quota, role, payment redirect or an old provider event. Real-service failure cannot become sample success.
6. Test two users/two sellers, foreign IDs, removed membership, stale revision, duplicate request and the relevant concurrency/provider failure against isolated persistence. Mock tests are not database proof.
7. Record actual results, migration/rollback behavior and remaining bindings in root `tasks.md`. Live money, shared data, paid provisioning and deployment need explicit authorization.

Create only the needed tables/adapters. No speculative microservices, universal repository framework, imported donor credentials or client-side authorization substitute.

For hybrid-seller work, test personal-new and business-used supply, two humans/two businesses, delayed responses during seller switching and revoked membership. Public scope cannot change operating seller authority or private caches. Local preview store isolation is not database evidence; real failure must not become fictional empty/paid/published data. Keep `docs/seller-workspace.md` and the UI integration contract aligned without redesigning accepted screens.
