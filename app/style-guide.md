> **Donor/reference document retained on 27 September 2026.** This file records the original Shop/Foods source context, not this derivative's product requirements or current execution policy. Read [the product README](../README.md) and [current tasks](../tasks.md). Never follow an old source path or donor remote to perform work for Treido Global.

# Style guide and design-system rules

Status: implementation discipline during Shop reconstruction; accepted token measurements and Treido brand values are still being established. This is not a claim that an approved final design system already exists.

## Two controlled phases

**Reference phase:** derive typography, palette, spacing, dimensions, radii, icon geometry, imagery and motion from the frozen Shop source. Preserve inspected distinctions between different states. Do not introduce food branding, decorative badges or a generic theme during parity.

**Treido phase:** after explicit source approval, change approved semantic tokens/content and necessary food semantics through the same canonical components. Record intentional departures and review adapted flows. There must not be two permanent competing homes, card systems or skins.

## Token evidence

For a new or changed token, record its name, value/unit, source frame or approved design decision, platform, code owner and validation state. Distinguish measured, implemented, compared and approved. Never write guessed values into a table as measured facts.

| Token family | Required evidence |
| --- | --- |
| Type | Font rights/availability, family, size, line height, weight, tracking and long BG/EN behavior |
| Color | Surface/text/action/border/overlay role, actual source sample and contrast review |
| Spacing/geometry | Container/padding/gap, card/image ratio, radius, dock/sheet/header bounds |
| Icons/media | Source silhouette/size/stroke/alignment; asset identity, crop, fit and publication rights |
| Motion/layers | Observed entry/exit, duration/easing when measured, backdrop, stacking, reduced-motion fallback |

Add a shared token when multiple actual consumers need it. Keep one-off source geometry local until repeated evidence warrants extraction. Do not invent a giant token package before useful values exist.

## Component ownership

One canonical component per visual role per platform. Shared browser primitives own semantics and interaction; feature composition owns contextual spacing/content. Native components implement native behavior and may consume approved shared values, not DOM styles.

Fix styles at the owning component/token. Avoid class-substring overrides, accumulating global `!important`, duplicated near-identical cards and viewport-specific alternate trees. Reference scenarios use the same components as real data, not screenshot-only copies.

## Interaction and responsiveness

All enabled controls perform their declared action. Labels, focus rings, keyboard navigation, modal containment, parent/child dismissal and focus return are part of styling quality. Hover-only information needs a touch/keyboard equivalent. Reduced motion and loading states remain usable.

Preserve measured mobile geometry at the comparison viewport; do not scale the live interface to force a match. At narrower/wider screens, use deliberate layout constraints and avoid horizontal clipping. Tablet/desktop adaptation uses the same product hierarchy, not a new unrelated navigation identity.

## Food presentation and trust

Food information must remain legible and structured: selling unit/pack, producer, relevant ingredients/allergens, storage, availability and fulfillment. Unknown facts stay unknown. Certifications and verification badges need authorized evidence. Do not trade essential disclosure for screenshot similarity or seller customization.

The seller CMS may expose a controlled subset of tokens/sections. Mandatory information, platform authority, checkout rules and accessibility constraints cannot be hidden or restyled into misleading claims.

## Review

Compare source/live pairs and related sibling states, then exercise the journey. An accepted baseline records source, viewport, fixture and commit; it is not automatically updated after a CSS change. [Verification](verification.md) owns checks and [design](design.md) owns comparison normalization and source acceptance.
