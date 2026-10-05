# Durable buyer library

T41 implements T08a in the existing web app. Saves, collections and seller follows belong to the human Clerk account, not to an operating seller, browser, device or reference-preview identity. The implementation receipt and remaining launch acceptance are in [tasks](../tasks.md).

## Ownership and persistence

The additive [0012 migration](../app/apps/web/migrations/0012_buyer_library.sql) defines six tables: buyer_libraries, saved_listings, buyer_collections, buyer_collection_items, seller_follows and buyer_library_receipts. It was applied to the qualified Neon development branch on October 3, 2026, with the previous eleven checksummed migrations unchanged. No production migration or public sample inventory was created.

Every server action resolves the existing verified Clerk identity. Reads never create a user, seller, collection or bookmark. The first successful command creates the human library through the existing identity transaction, without creating a seller. Collection memberships have same-human composite foreign keys. Runtime grants prevent changing ownership identifiers or rewriting command receipts.

A human lock serializes mutations, limits and revisions. The command envelope contains an opaque subject-bound actor fingerprint, expected library revision, unique request ID and explicit desired operation. The server binds and hashes the request, records an immutable receipt and increments the revision in the same transaction. An identical concurrent retry receives the same result. A different payload under that request ID, stale-device command or replay superseded by a later revision conflicts rather than restoring an old save or follow.

The UI reads database projections and changes state after an acknowledged command. Memory holds only the current response and retry envelope. BroadcastChannel carries invalidation signals, not inventory, collection contents or account data. Hidden views clear their private projection; focus, reconnect and foreground refresh reload authoritative state. A response from an earlier route/request cannot overwrite the new view. An uncertain transport response retries the same request ID.

## Supported operations

Save and unsave work on public cards, accepted product detail and Saved. Unsave also removes that listing from all of the human's collections in one transaction. Re-saving does not resurrect earlier collection memberships.

Create, rename and delete operate on private collections. Creating a collection from a product and including the product is atomic. Adding from Saved uses the same membership command and persists each choice. Removing a membership does not unsave the item. Deleting a collection removes its memberships but retains the independently saved items; the existing sheet requests explicit confirmation. Collection sharing/public visibility is not presented as implemented.

Follow and unfollow work in public seller headers, product-to-seller navigation and the Following destination. Saved and Following have signed, human/view/collection-bound keyset pagination. Current counts come from the database; there are no synthetic popularity or follower totals.

Limits are centralized in the [library model](../app/apps/web/src/features/library/model.ts): 2,000 saved listings, 1,000 follows, 100 private collections, 80-character names, 24 rows per page, 100 IDs per state lookup and 120 accepted commands per minute. The server applies these limits under the same mutation lock; clients cannot grant themselves extra capacity.

## Unavailable publications and sellers

New saves, follows and collection additions require current public eligibility. Saved cards and collection covers use the same accepted-snapshot, seller, category, moderation, rights and media eligibility as discovery. Private draft edits, unpublished photos, storage keys and private business declarations are not library fallbacks.

A previously saved listing that is withdrawn, restricted or otherwise unavailable remains an owned bookmark with a generic unavailable explanation. Only its already-owned ID is retained in that projection, not an old title or photograph. Removal remains possible. An unavailable followed seller similarly retains an unfollow control without leaking private seller information. A failed database read is an unavailable state, never a fabricated empty collection.

## Existing UI and sign-in

Shop ProductCard, SavedCard, Sheet, source navigation, floating dock and current buyer styling remain the presentation owners. New optional controlled-heart props preserve reference defaults. The separate reference routes still use their existing preview state and data; private merchant styling is unchanged.

Real Home, Search, product/store, Saved and Following routes now pass through the existing Clerk middleware without requiring sign-in just to browse. Guest save/follow attempts offer sign-in with an allowlisted local buyer return path. Returning from sign-in does not itself execute a mutation. New action, error, loading, empty, selection and confirmation copy is paired in BG/EN.

## Evidence and limits

The native PostgreSQL cases exercise real migrations and runtime grants, transaction rollback, two-human isolation, repeated and stale requests, cross-connection persistence, private collections, exact microsecond pagination and post-withdrawal redaction. The component-browser journey exercises actual controls against those database use cases, including reload, collection editing and selection, follow/unfollow, cross-tab updates, BG/EN and 320/393/1440 layouts.

The component transport uses explicitly synthetic verified identities and is not deployed. It does not prove live Clerk browser sessions, production Next action transport, storage CORS, Inngest callbacks, domain deployment or complete launch acceptance. The live development migration and independent Neon privilege checks are recorded separately in T41. No local-only inventory substitute is used by the application.

## Private Neon media option

The existing media boundary now supports TREIDO_MEDIA_PROVIDER=neon as well as the prior R2 adapter. The Neon option requires the existing private bucket, purpose-specific prefix, exact same-branch endpoint and co-located EU region. Credential bindings are AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, with AWS_ENDPOINT_URL_S3 and AWS_REGION kept server-only. Do not copy credentials into source, browser variables, receipts or chat.

Presigned writes remain limited to staging. Completion reads the matching ETag with a byte bound and checks the expected SHA-256 before writing a fresh server-only immutable key. The existing ownership/outbox/Sharp processing and publication rules remain authoritative. This path does not depend on R2 copy extensions or assume that Neon enforces stored versioning/lifecycle settings.

The configuration command is registered as media:configure. With an approved credential already securely bound, run the non-mutating --check first. The explicit --apply-cors --branch form supports only the declared development/test branch, preserves unrelated CORS rules, scopes PUT to the application origin and verifies the browser preflight. It neither creates a bucket nor enables a subscription. Do not run it without the actual scoped binding or make a private bucket public to work around delivery.

On October 3, provider inventory confirmed an already-enabled private Neon development bucket. A tool security check prevented binding a newly scoped credential locally; that unused credential was immediately revoked. No storage credential was installed and no paid R2 subscription was enabled. Repeated secret-transfer workarounds are not an approved resolution. The real browser upload/CORS/worker/publish/contact journey remains blocked on secure binding, actual signed worker callback operation, reviewed category/seller input and real photo rights. Scoped expiry/orphan/raw-object cleanup and production retention remain open launch work; configuring a lifecycle document is not claimed as cleanup execution.
