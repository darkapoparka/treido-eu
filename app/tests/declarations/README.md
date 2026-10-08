# Synthetic declaration component acceptance

This fixture renders the unchanged production `DeclarationReviewForm`, `Workspace`, confirmation dialog, recovery hook, global CSS and their CSS modules. Clerk identity, operator authority, private contacts, declaration reads, decisions and receipt persistence are deliberately synthetic. It does not establish real Clerk/operator/database/provider or Production acceptance. No secrets or provider transport are used.

The coordinator owns running both commands from `app/` with the pinned Node24.20.0/pnpm12.3.4. This fixture creates only its owned `.qa/launch-seller-review-20261008/browser/` bundle/evidence and an owned loopback HTTP listener. It rejects protected app/donor ports, public Host headers and HTTP write requests. It never deletes output or stops another listener.

Manual labelled CUA server:

```text
node tests/declarations/serve.mjs
node tests/declarations/serve.mjs --port=6426
```

Use the printed loopback URL. `?lang=bg&long=1` opens long BG facts; `?auto=0` leaves initial/private reads pending. The visible controls are outside the production component. They change fixture identity independently of mounted actor props, open A/B server-prop contexts, remount, advance setup, toggle BG/EN/long facts/read-only state, fail storage and settle individual deferred reads/writes. “Commit, lose response” retains a synthetic receipt across a full reload and lets the real client retry its unchanged request. Both the banner and server metadata label that receipt model synthetic.

The production form uses **sessionStorage** for recoverable input. Failed sessionStorage must retain memory-only input and prevent an unrecorded command. The separate failed localStorage control demonstrates that this unrelated storage has no authority over the form. Recovery data contains the operator-scoped bounded reason/request/revisions, never private contact facts. The fixture's separate synthetic model key is test instrumentation and is not production receipt persistence.

Automated regression/screenshot preparation:

```text
node tests/declarations/browser.mjs
```

It uses the already installed lockfile-pinned Playwright Chromium and the same owned fixture server. No dependencies or browser installation are added. Assertions cover immediate A→B/logout concealment and deferred responses, B failure/recovery, exact unknown-outcome retry after reload, definite conflict/current revision capture, read epoch/revocation, storage failures, contact-fact minimization, keyboard dialog/Escape/focus return and corrupt recovery. It captures long EN/BG review and confirmation states at320/393/1440px using the original CSS.

`browser/result.json` records failure honestly and separates fixture behavior/screenshots from actual operator/provider/native and visual approval. `SYNTHETIC-*-review.png` and `SYNTHETIC-*-confirmation.png` require manual review. Screenshots are local component evidence, not matched native Shop parity or real `/ops` browser approval. The real operator journey stays blocked until intended credentials and current authority are qualified.

Preparation-only status: this agent authored these files and may run syntax/lint/format checks. It has not started a build/listener/browser/native cluster/provider. The coordinator must execute and inspect the results before recording any PASS.
