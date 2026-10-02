# Design direction

The existing Shop-derived buyer frontend and Shopify-derived Studio are separate scoped visual foundations. **[styling.md](styling.md) is the sole styling and visual-regression contract.** This file remains as a compatibility entry point for older links.

The approved direction is general physical-goods resale with personal and business sellers. The implemented public browse selector, item-condition/seller disclosures, selling and messaging surfaces retain their existing component families. Read the relevant [UI pattern](docs/ui-patterns.md) and [acceptance protocol](docs/ui-verification.md); the buyer and merchant systems are not interchangeable. Branding/content changes and any visible accessibility correction need a recorded, bounded task; they do not authorize a new theme or a generic dashboard.

Refactoring first preserves rendered output. Product changes subsequently document their deliberate differences. Reference evidence is not permission to publish Shop branding, private captures, contact details or unlicensed assets. See [operations](docs/operations.md) before public release.
