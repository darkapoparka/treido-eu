import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BillingRecoveryHistory } from "./recovery-history";
import type { BillingRecoveryReceipt } from "./queries.server";
const receipt: BillingRecoveryReceipt = {
  id: "00000000-0000-4000-8000-000000000001",
  intentId: "00000000-0000-4000-8000-000000000002",
  operation: "escalate",
  state: "complete",
  createdAt: "2026-10-10T12:00:00.000Z",
  updatedAt: "2026-10-10T12:00:01.000Z",
};
describe("durable recovery receipt presentation", () => {
  it("does not label a saved support request as a successful money outcome", () => {
    const html = renderToStaticMarkup(
      <BillingRecoveryHistory receipts={[receipt]} language="en" />,
    );
    expect(html).toContain("Recovery request recorded");
    expect(html).toContain("not successful payment");
    expect(html).toContain(
      "not proof that an external support recipient has been contacted",
    );
    expect(html).toContain(receipt.intentId);
    expect(html).not.toContain("Payment successful");
  });
  it("renders BG persisted receipt labels and bounded empty history", () => {
    expect(
      renderToStaticMarkup(
        <BillingRecoveryHistory receipts={[receipt]} language="bg" />,
      ),
    ).toContain("Ескалация за поддръжка");
    expect(
      renderToStaticMarkup(
        <BillingRecoveryHistory receipts={[]} language="bg" />,
      ),
    ).toContain("Няма записани заявки");
  });
});
