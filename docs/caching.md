# Caching and freshness

Current code: `cacheComponents` is **not enabled** in `app/apps/web/next.config.ts`; catalog reads intentionally use request-bound reference scenarios. This document is the target policy, not evidence that the app already has production caching. Read installed-version Next documentation before adding an API.

## First rule: correctness before reuse

A cache stores a permitted projection, never authority. Permissions, current seller membership, private data access, availability/allocation, quotes and money are checked on the server. Do not infer authorization from a cached page, previous request, optimistic state or provider status string.

| Read | Initial policy | Key / invalidation |
|---|---|---|
| Public category definitions and labels | Cache once implemented | Taxonomy version + locale; invalidate on taxonomy publish |
| Public catalog summaries / facets | Bounded tagged cache after measured need | Normalized query, seller kind, category, condition, price, geography, locale, currency, sort, cursor; invalidate on listing/seller changes |
| Public listing/seller content | Only reviewed non-private projection | Resource + relevant revision/locale; fresh eligibility gate for restricted data |
| Own saves, drafts, inbox, addresses, orders, entitlements | Uncached/private initially | Authenticate and authorize every request; no shared cache key from a client-selected seller ID |
| Checkout quote, allocation, publish quota, refund | Authoritative database read/write | Never use stale shared cache as a decision input |
| Moderation/removal/media access | Fresh restriction check and explicit invalidation | Block new disclosures immediately on authorized reads; purge derived public material |
| Reference fixtures/scenarios | Explicit preview path only | Scenario isolation; never reused as product fallback |
| Sponsored selection | Fresh eligibility/capacity gate around any reusable public projection | Query/seller/leaf/condition/geography/money + placement revision; paid status never inferred from a card |
| Stock/variant choices | Public summary may be stale; quote/action rereads authority | Listing/SKU revision; allocation/stock event invalidates display, no cached quantity as purchase permission |
| Assistant result facts | Bounded fresh public tool queries | Exact user constraints; filter current eligibility before returning IDs/prices; no cross-human prompt/media cache |
| Import/operator/AI budget | Private authoritative reads/writes | Current actor/capability, plan and cost/usage transaction; no shared caching |

`no-store` on a fetch is not a universal solution for ORM reads. Make the owning route/query's rendering and cache behavior explicit. React request memoization, a persistent server cache, client router state and a CDN are different layers; invalidating one does not automatically erase all others.

## Choose one coherent Next model

Do not scatter incompatible cache APIs across the app. Keep current behavior during baseline/extraction. When T14 qualifies Cache Components, enable `cacheComponents: true` in a dedicated change and migrate compatible public queries with `use cache`, `cacheLife` and `cacheTag`; test existing routes and Suspense boundaries first. Do not write `use cache` while forgetting the required configuration.

Read cookies/headers/auth outside a shared cached scope. Pass only normalized, public result-shaping inputs. Including `sellerId` in a key does not make an unauthorized query safe. Private request values must not accidentally become shared closures or props. Avoid experimental private/remote caching as initial architecture.

Use explicit lifetimes based on measured freshness needs, not an arbitrary global cache duration. Keep user-controlled key cardinality bounded through validation and pagination. Choose tags such as `listing:<id>`, `seller:<id>`, `catalog:<country>`; document affected tag families beside the write that changes them. Cache Components guidance: [use cache](https://nextjs.org/docs/app/api-reference/directives/use-cache).

## Mutation and invalidation

Commit database state first. A Server Action can use `updateTag` for immediate expiry/read-your-own-writes. `revalidateTag(tag, 'max')` uses stale-while-revalidate and is appropriate only where a stale public summary is acceptable. The one-argument form is deprecated. `updateTag` is Server-Action-only; Route Handlers/webhooks use a supported explicit revalidation profile such as `{ expire: 0 }` when immediate expiry is required. Verify the installed API before implementation.

Use `revalidatePath` for affected path output when tag invalidation alone does not cover it. Route-handler invalidation does not guarantee that an already open client view instantly changes; plan client refresh/subscription behavior where needed. A task must test both a new request and an already open buyer/seller view.

If invalidation fails after a committed write, retry through durable intent rather than roll back a completed transaction or claim success means every cache is fresh. Listing publication, withdrawal, price/availability changes, seller restriction, taxonomy and media revision all need explicit invalidation ownership.

## Safety-sensitive removal

Do not rely on stale-while-revalidate for restricted or removed content. Initially keep safety-sensitive detail/media reads uncached or place a fresh authorized visibility gate outside cached content and ensure full-route/CDN caching cannot bypass it. Filter stale search results against current eligibility before returning sensitive content, then replenish the bounded page as needed.

Use revocable media delivery/private object storage where removal matters. Immutable public URLs cannot be recalled from a browser that already downloaded them; document that limitation rather than promise deletion from the internet. New responses, metadata, search, saves and direct media URLs must respect restrictions. Permission changes and legal removals require immediate checks, not “eventually the TTL expires.”

## Required cache tests

Different users and seller scopes never share private data. Every query dimension changes the result key appropriately. Publish/edit/withdraw/restrict tests cover list/detail/metadata/media, both warm and cold cache, and a direct link. Check read-your-own-writes, duplicate invalidation events and failure/retry. Sold items cannot be purchased even while a stale public card exists. Do not call caching complete after only measuring a faster page.

References: [revalidation](https://nextjs.org/docs/app/getting-started/revalidating), [revalidateTag](https://nextjs.org/docs/app/api-reference/functions/revalidateTag). These APIs can change; the local installed version is the implementation authority.
