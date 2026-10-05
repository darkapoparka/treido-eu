# Seller onboarding and acquisition kit

This kit accompanies the real `/sell/start` guide and `/support` help routes. It describes preparation and the implemented workflow, not an announcement that the marketplace, payment provider or every catalogue leaf is live. Root [tasks](../tasks.md) owns verified availability; [launch](launch.md) owns the release decision. No outreach is sent by opening these pages or downloading a template.

## Personal selling walkthrough

Open `/sell/start?kind=personal&lang=en` (or `lang=bg`). Prepare a truthful item title, a supported leaf category, condition, defects, required specifications, EUR price and approximate locality. Use original or expressly licensed photos; do not include addresses, account documents, payment information or somebody else's private details in a public listing. Personal and business sale classifications are independent of item condition.

Continue to the existing selling entry and sign in through Clerk. Review the current owned draft rather than creating a replacement after an uncertain save. Add photos through the private upload controls; a selected file is not a processed or published photo. Confirm current stock and available handover options. Review the exact saved revision, category and photo state before an explicit publication request. Missing policy, declaration, service or media readiness must remain visible; this guide does not approve them. Check the published item from an independent buyer session and confirm withdrawal removes new public access.

A saved inquiry, accepted offer or inventory reservation is not a paid order. Use the current order and payment controls only when they are actually available and the full amount and terms are shown. A redirect or screenshot of a payment does not confirm it.

## Business onboarding session

Choose `/sell/start?kind=business&lang=en` or `lang=bg`. Identify the business owner and actual staff permissions. Prepare business/profile information separately from the private declaration and payout details. A submitted declaration is not an approval. Plan and fee examples remain proposals until the actual environment's approved catalogue presents them; never promise a free or paid entitlement that the current workspace does not provide.

Download the empty CSV and category guide from the page. The template uses the existing importer, not an alternate schema. Keep one stable `external_id` for each source item. Use a leaf `category_id`, an allowed condition, EUR prices and the category's required `attributes_json`; declare stock only when it is known. The current CSV represents one draft and its supported initial inventory definition per row, not an arbitrary multi-variant catalogue interchange. Add or review further variant combinations in the owned product controls.

The on-device CSV checker decodes UTF-8 strictly, applies the real parser and row contracts, and flags every duplicate external ID in the selected file. It supports up to 10 MiB and 1,000 rows, with 25-row review pages and an issue CSV. It makes no server request with the file and saves neither its contents nor the result. Passing this check does not prove account quota, a previously imported ID, current permission, policy approval or publication readiness. Those checks run again in the private importer. Clear the file when finished; navigating away discards this local review.

In the business workspace, select the actual operating seller, upload the reviewed file, correct and select rows, and start the bounded import. Review created draft links and unresolved rows before retrying. Imports do not automatically publish or fetch external photo URLs. Add rights-cleared photos, verify quantities, configure truthful delivery/contact information, and publish deliberately. Test invitation acceptance and subsequent staff revocation without sharing an owner's login. Qualify checkout, refund, plan and boost workflows separately before offering them to customers.

## Support routing

`/support` and `/support/help` provide bilingual links to the existing private order, conversation, report, appeal, privacy/security and invitation workflows. An order problem should be opened from the affected order; a listing or message report should use the affected resource's Report control. This preserves exact context and authorization. `/support/chat` explicitly states that a live-agent chat is unavailable and no message has been sent; it never simulates a staff reply.

Do not publish a support response-time promise or an operator email until an accountable owner and monitored contact are assigned. Do not request passwords, sign-in codes or complete card details. Follow the private retention and incident process in [operations](operations.md), not an ad hoc public spreadsheet containing customer data.

## Unsent invitation drafts

The following copy is a draft for an owner-selected recipient. Replace bracketed fields with verified facts before any authorized send. Do not imply consent, a prior relationship, live payments, sales, traffic or a service guarantee. This document does not grant permission to send a campaign or import a contact list.

### English

Subject: Prepare your catalogue for Treido

Hello [name],

We are preparing Treido for personal and business selling. Would [business] be interested in reviewing the seller workflow? You can inspect the guide and empty catalogue template before sharing any inventory. The guide explains drafts, photos, stock and the steps that still depend on account and service readiness.

A proposed onboarding session would review your own product information, photo rights and staff access. Nothing would be published or charged without the relevant explicit action and confirmed terms. There is no promise of sales or buyer traffic.

Guide: [verified Treido guide address]
Contact: [monitored owner contact]

Please reply only if this is relevant. [Owner-approved opt-out wording and handling]

### Български

Тема: Подготовка на вашия каталог за Treido

Здравейте, [име],

Подготвяме Treido за лични и бизнес продажби. Би ли имал [бизнес] интерес да разгледа процеса за продавачи? Можете да прегледате ръководството и празния шаблон за каталог, преди да споделяте наличности. Ръководството обяснява черновите, снимките, наличностите и стъпките, които зависят от готовността на акаунта и услугите.

Предложената сесия за въвеждане би прегледала вашите собствени продуктови данни, права върху снимките и достъп на служителите. Нищо няма да бъде публикувано или таксувано без съответното изрично действие и потвърдени условия. Не обещаваме продажби или посетители.

Ръководство: [проверен адрес на ръководството в Treido]
Контакт: [наблюдаван контакт на отговорното лице]

Отговорете само ако предложението е подходящо за вас. [Одобрен текст и процес за отказ от бъдещ контакт]

## Recruitment and readiness record

Maintain only owner-selected, legitimately usable prospective-seller contacts in an access-controlled operational record. This kit provides the field definition, not an invented recruitment list. No businesses or personal sellers have been recruited by creating it.

| Field | Definition |
|---|---|
| Prospect reference | Internal opaque reference, not a public customer identifier |
| Seller kind / category | Self-declared personal/business intent and proposed supported category |
| Contact provenance / permission | Where the owner obtained the contact and the permitted purpose; unknown is not consent |
| Accountable owner / next action | Named responsible person and an explicit, authorized next action |
| Workflow stage | Not contacted, authorized contact sent, response received, session agreed, draft prepared, publication qualified, independently discoverable |
| Rights / declaration / stock readiness | Actual reviewed evidence or unknown; never a guessed approval |
| Service readiness | Separately verified messaging, media, invitation, checkout, fulfilment, plan and boost capabilities |
| Opt-out / retention decision | Current contact restriction and reviewed deletion/retention handling |

Actual seller names, contact permission, photo rights and declarations must come from consenting sellers and the accountable owner. T28b is not completed by filling this record with fixtures, scraped inventory or template companies.

## Funnel definition

Use stable event identities and privacy-reviewed collection before enabling acquisition measurement. Definitions below specify the intended measurements, not proof that an analytics transport is running. Do not add unapproved tracking cookies or send the on-device CSV contents as telemetry.

| Event | Count only when | Exclude |
|---|---|---|
| Guide visit | A permitted measured guide view, deduplicated within the reviewed measurement window | Bots, reload inflation, reference routes and QA |
| Preparation check | A user explicitly checks a file; record only permitted aggregate outcome, never row contents | File names, item text, identifiers, attributes and contact data |
| Draft started / completed | The real owned server draft exists / meets the current draft completion definition | Local preflight, template downloads, duplicate retries |
| Valid publication | An explicit command creates an accepted currently eligible publication | Queued processing, policy-pending drafts, fixtures |
| Qualified inquiry | A real participant message referencing eligible supply is committed | Self-contact, simulated support replies, unacknowledged browser sends |
| First seller response | A permitted seller reply is committed after the first inquiry | Replays and staff tests |
| Confirmed item order | Authoritative provider evidence creates the real item order | Redirects, offers, holds, contact-only handover, plans and boosts |
| Refund / case | The actual scoped financial or case event occurs | A requested refund represented as completed money movement |

Report conversion by an explicitly defined, eligible cohort and time window. Keep unknown stages, denominator changes and abandoned attempts visible. Measure time to first valid draft, publication, inquiry and seller response; report confirmed item GMV separately from plan/boost revenue and seller-reported off-platform sales. Do not claim measured traction until the corresponding provider, consent and event evidence exists.
