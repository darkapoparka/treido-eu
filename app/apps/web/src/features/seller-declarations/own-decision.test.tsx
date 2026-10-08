import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { OwnDeclarationDecisionNotice } from "./own-decision";

it("renders the seller's plain-text reason without executing submitted HTML", () => {
  const reason = '<img src=x onerror="alert(1)">\nCorrect the address';
  const html = renderToStaticMarkup(
    <OwnDeclarationDecisionNotice
      decision={{
        decision: "rejected",
        reason,
        revision: 2,
        reviewedAt: "2026-10-08T05:00:00.000Z",
      }}
      language="en"
    />,
  );
  expect(html).toContain("Trader details need correction");
  expect(html).toContain("&lt;img");
  expect(html).not.toContain("<img");
  expect(html).toContain(
    "does not confirm verification or permission to publish",
  );
});

it("has no decision notice when the server provides no current authorised decision", () => {
  expect(
    renderToStaticMarkup(
      <OwnDeclarationDecisionNotice decision={null} language="bg" />,
    ),
  ).toBe("");
});
