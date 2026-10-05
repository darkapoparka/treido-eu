import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { InputConsentWithdrawal } from "./consent-withdrawal";
const choice = {
  policyId: "10000000-0000-4000-8000-000000000001",
  granted: true,
};
it("offers a deliberate own-choice withdrawal independently of any usable processing policy", () => {
  const callback = vi.fn();
  for (const locale of ["bg", "en"] as const) {
    const markup = renderToStaticMarkup(
      createElement(InputConsentWithdrawal, {
        choice,
        locale,
        blocked: false,
        onWithdraw: callback,
      }),
    );
    expect(markup).toContain("<button");
    expect(markup).not.toContain("disabled=");
    expect(markup).toContain(
      locale === "bg"
        ? "Оттегляне на съгласието"
        : "Withdraw processing consent",
    );
    expect(markup).toContain(
      locale === "bg" ? "след изтичането" : "after its expiry",
    );
  }
  expect(callback).not.toHaveBeenCalled();
});
it("an absent or already withdrawn choice grants nothing and a pending original command stays fenced", () => {
  const callback = vi.fn();
  for (const current of [null, { ...choice, granted: false }])
    expect(
      renderToStaticMarkup(
        createElement(InputConsentWithdrawal, {
          choice: current,
          locale: "en",
          blocked: false,
          onWithdraw: callback,
        }),
      ),
    ).toBe("");
  expect(
    renderToStaticMarkup(
      createElement(InputConsentWithdrawal, {
        choice,
        locale: "en",
        blocked: true,
        onWithdraw: callback,
      }),
    ),
  ).toContain('disabled=""');
  expect(callback).not.toHaveBeenCalled();
});
