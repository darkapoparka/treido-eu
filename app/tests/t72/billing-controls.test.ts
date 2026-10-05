import { describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { BillingControls } from "../../apps/web/src/features/seller-billing/controls";
import { billingText } from "../../apps/web/src/features/seller-billing/messages";
import type { SellerBillingView } from "../../apps/web/src/features/seller-billing/queries.server";
import css from "../../apps/web/src/features/seller-billing/billing.module.css";

vi.mock("../../apps/web/src/features/seller-billing/actions", () => ({
  billingCommandAction: vi.fn(),
  recoverBillingAction: vi.fn(),
  billingRecoveryCommandAction: vi.fn(),
}));
vi.mock("../../apps/web/node_modules/@clerk/nextjs", () => ({
  useClerk: () => ({ user: { id: "user_T72Synthetic" } }),
  useReverification: (action: unknown) => action,
}));
vi.mock("../../apps/web/node_modules/next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
const requireWeb = createRequire(
  new URL("../../apps/web/package.json", import.meta.url),
);
const React = requireWeb("react"),
  { renderToStaticMarkup } = requireWeb("react-dom/server");
const evidence = path.resolve(import.meta.dirname, "../../../.qa/t72/billing");
describe("T72 synthetic BG/EN recovery controls rendered with the existing feature CSS", () => {
  for (const language of ["bg", "en"] as const)
    for (const recovery of ["legacy", "invoice"] as const) {
      it(`${language} ${recovery}: actual recover/escalate controls and honest cancellation availability`, () => {
        const view = {
          sellerId: "00000000-0000-4000-8000-000000000002",
          actorKey: "a".repeat(64),
          actorSubject: "user_T72Synthetic",
          available: false,
          plans: [],
          subscription: null,
          intents: [
            {
              id: "00000000-0000-4000-8000-000000000003",
              requestId: "00000000-0000-4000-8000-000000000004",
              operation: "change",
              state: "ready",
              expiresAt: "2020-01-01T00:00:00.000Z",
              url:
                recovery === "invoice"
                  ? "https://invoice.stripe.com/i/synthetic"
                  : null,
              preview: null,
              revision: 2,
              recovery,
            },
          ],
        } as unknown as SellerBillingView;
        const html = renderToStaticMarkup(
            React.createElement(BillingControls, { view, language }),
          ),
          t = billingText(language);
        expect(html).toContain(t.reconcile);
        expect(html).toContain(t.escalate);
        expect(html).toContain("/support/help");
        if (recovery === "legacy") {
          expect(html).toContain(t.legacyRecovery);
          expect(html).not.toContain(t.abandon);
        } else {
          expect(html).toContain(t.abandon);
          expect(html).toContain("https://invoice.stripe.com/i/synthetic");
        }
        let styles = readFileSync(
          new URL(
            "../../apps/web/src/features/seller-billing/billing.module.css",
            import.meta.url,
          ),
          "utf8",
        );
        for (const [name, hash] of Object.entries(css))
          styles = styles.replaceAll(
            new RegExp("\\." + name + "\\b", "g"),
            "." + hash,
          );
        mkdirSync(evidence, { recursive: true });
        writeFileSync(
          path.join(
            evidence,
            `synthetic-controls-${language}-${recovery}.html`,
          ),
          `<!doctype html><html lang="${language}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic T72 billing control review</title><style>body{margin:16px;font:14px/1.3 system-ui}*{box-sizing:border-box}${styles}</style><body><p>SYNTHETIC UI REVIEW · no authenticated account/provider evidence</p>${html}</body></html>`,
        );
      });
    }
});
