# Local dependency source mitigations

These exact-version pnpm patches are local mitigations, not official fixed releases.
The versions and registry integrity entries stay `node-forge 1.4.0` and `braces 3.0.3`.
Both advisories still have no released fixed version at the October 5, 2026 review;
the unsuppressed dependency audit and release qualification remain unresolved.
The existing `query-string 7.1.3` patch and decoder override remain unchanged.

## node-forge

Primary evidence: [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv),
[forge issue 1149](https://github.com/digitalbazaar/forge/issues/1149), and proposed
[PR 1152](https://github.com/digitalbazaar/forge/pull/1152/files), reviewed at open
head `ceba34402e329f0365134f23fe19898756527d65` in `Krysthyan/forge`.
The proposed change is neither merged nor represented here as released.

Only `lib/rsa.js` changes. The local check retains the original outer cardinality,
padding, trailing-byte parsing and algorithm rules; it adds nested cardinality
(OID plus an optional primitive NULL) and requires NULL to have empty contents.
The existing validator checks tag class/type/constructed form. No ASN.1 parser or
cryptographic primitive changes. SHA encodings retain absent/NULL parameters;
the prior MD2/MD5 mandatory NULL rule remains. This does not validate every possible
ASN.1 encoding or certify cryptographic security. MD2/MD5 compatibility tests are
legacy encoding checks, not recommendations for their use.

Original `lib/rsa.js` SHA-256:
`fd4740238145ec26470eb3f06a627c72039538ce1307dbdce40521f94dfd0a50`.
The regression generates a disposable synthetic RSA key and message in memory,
signs deliberately malformed DigestInfo with correct PKCS#1 padding, and proves
original acceptance versus patched rejection through default public verification.
Genuine signing/verification, PSS, digest encodings and prior guards are covered.
This reproduces malformed-structure acceptance; it is not a new public-key-only
forgery construction. No product/user keys or captured signatures are used.

## braces

Primary evidence: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
and [braces issue 70](https://github.com/micromatch/braces/issues/70).
This independently implemented local mitigation changes `lib/parse.js`,
`lib/compile.js`, `lib/expand.js`, `lib/stringify.js`, and adds `lib/guard.js`.

The parser admits up to 100 combined brace/parenthesis nesting levels, counting
actual parser blocks rather than delimiters inside escapes/quotes/brackets.
All three walker modules preflight direct AST input iteratively: at most 102
nodes on any recursive path (root and terminal included), 20,003 child visits,
and no child-edge cycles. Shared subtrees count on each visit; ordinary parser
`parent`/`prev` back-references remain valid. Expansion's independent parent
lookups are also bounded. Caller `maxDepth` cannot raise these hard bounds.

Expansion is capped at 10,000 values and 1,000,000 total output string code units
per intermediate/final array. Numeric ranges are checked before allocation,
including descending ranges and `rangeLimit:false`; append operations check
their cumulative result before growing beyond these limits. Existing 10,000
character input limit, default 1,000 range limit and stricter caller limits stay.
Large previously accepted expansions intentionally fail with a safety-limit
SyntaxError. Normal ranges, escaping, extglobs and actual micromatch/fast-glob
APIs have regression coverage. Engine stack sizes vary, so tests separately
prove original under-character-cap deep-pattern acceptance and direct-AST stack
exhaustion rather than requiring a particular parsed-pattern crash threshold.

Original changed-file SHA-256 values:

| File | SHA-256 |
| --- | --- |
| `lib/parse.js` | `e572166565f15fa6ad9865ae49d678218e32aabfd1b3720f6d0d43d39800d310` |
| `lib/compile.js` | `dc98f22eee3d511785d92a00758d5f0d48efed5f5813bdecc2de430c529b5c9f` |
| `lib/expand.js` | `41ccc196ebfa7b7781a634e721eb744e4e7bcb54cba427a7e3d6806a1b9e58f7` |
| `lib/stringify.js` | `379f22d77bfa1478341ccd49c5e4267464aabcbba03558bab332aac23fc6f23a` |

These bounds address recursive traversal and expansion amplification, not all
possible process resource exhaustion. Caller-supplied JavaScript getters,
proxies, transforms, arbitrary oversized AST text values, application request
volume and downstream regex execution require separate caller boundaries.

## Reproduction and integration

Tests live in regular `tests/t71/*security-source.test.ts`, selected by the
existing Vitest config; no private evidence scripts or directories are required.
The loader applies exact-context unified diffs in memory and validates original
source hashes. After a real patched install it reverses those same diffs to
reconstruct the original for differential checks. It never writes packages.

From `app/`, using pinned Node 24.20.0 and pnpm 12.3.4:

```text
pnpm exec vitest run tests/t71/forge-security-source.test.ts tests/t71/braces-security-source.test.ts -t "source mitigation" --configLoader native --pool threads --maxWorkers 1
```

The Windows native config loader/thread pool avoid an observed default-loader
`spawn EPERM` failure; they do not change test assertions. Installed-consumer
tests are deliberately excluded only from this pre-install source command.
The parent must coordinate a frozen install after both concurrent source writers
stop, then run both files without the name filter and the existing
`tests/t71/dependency-regression.test.ts`. Preserve the unsuppressed audit gate.
Source validation does not qualify native Expo exports, full builds, live
providers, production or release readiness.
