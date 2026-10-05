import { expect, it } from "vitest";
import { parseWorkspaceContinuation } from "./workspace-continuation";
it("preserves only exact read-only paid-order aftercare and feedback returns", () => {
  const id = "cf081b46-5730-4978-b8eb-d50825a7b508";
  const seller = "b3db8275-e48a-4f4c-8a9e-b2805ab04631";
  for (const route of [
    `/orders/${id}/support`,
    `/orders/${id}/feedback`,
    `/app/sellers/${seller}/orders/${id}/support`,
    "/ops/order-aftercare",
    `/ops/order-aftercare/${id}`,
  ]) {
    expect(parseWorkspaceContinuation(route + "?lang=en")).toBe(
      route + "?lang=en",
    );
    for (const suffix of [
      "?refund=true",
      "?rating=5",
      "?role=operator",
      "?lang=bg&lang=en",
      "/../support",
      "#confirm",
    ])
      expect(parseWorkspaceContinuation(route + suffix)).toBeNull();
  }
  for (const route of [
    "/orders/foreign/support",
    `/app/sellers/foreign/orders/${id}/support`,
    `/app/sellers/${seller}/orders/foreign/support`,
    "/ops/order-aftercare/foreign",
    `/app/sellers/${seller}/orders/${id}/feedback`,
  ])
    expect(parseWorkspaceContinuation(route)).toBeNull();
});
it.each(["billing", "promotions"])(
  "preserves the exact %s destination without accepting authority or provider-success flags",
  (feature) => {
    const route =
      "/app/sellers/b3db8275-e48a-4f4c-8a9e-b2805ab04631/" + feature;
    expect(parseWorkspaceContinuation(route + "?lang=bg")).toBe(
      route + "?lang=bg",
    );
    for (const suffix of [
      "?role=owner",
      "?success=true",
      "?price=price_arbitrary",
      "?lang=bg&lang=en",
      "/activate",
      "/../billing",
    ])
      expect(parseWorkspaceContinuation(route + suffix)).toBeNull();
    expect(
      parseWorkspaceContinuation(
        route.replace("b3db8275-e48a-4f4c-8a9e-b2805ab04631", "foreign"),
      ),
    ).toBeNull();
  },
);
it("resumes the merchant catalog without trusting query authority", () => {
  const route = "/app/sellers/b3db8275-e48a-4f4c-8a9e-b2805ab04631/listings";
  expect(parseWorkspaceContinuation(route + "?lang=bg")).toBe(
    route + "?lang=bg",
  );
  expect(parseWorkspaceContinuation("/app/products?lang=en")).toBe(
    "/app/products?lang=en",
  );
  expect(parseWorkspaceContinuation(route + "?role=owner")).toBeNull();
});
it("retains only the exact operator destination without granting operator access", () => {
  expect(parseWorkspaceContinuation("/ops?lang=bg")).toBe("/ops?lang=bg");
  for (const value of [
    "/ops/secret",
    "/ops?role=operator",
    "//example.com/ops",
    "/ops?lang=bg&lang=en",
  ])
    expect(parseWorkspaceContinuation(value)).toBeNull();
});
it("resumes only an exact saved review route with canonical resource IDs", () => {
  const route =
    "/app/sellers/b3db8275-e48a-4f4c-8a9e-b2805ab04631/listings/cf081b46-5730-4978-b8eb-d50825a7b508/review";
  expect(parseWorkspaceContinuation(route + "?lang=bg")).toBe(
    route + "?lang=bg",
  );
  expect(parseWorkspaceContinuation(route + "?role=owner")).toBeNull();
  expect(
    parseWorkspaceContinuation(route.replace("review", "publish")),
  ).toBeNull();
});
