import { expect, it } from "vitest";
import { parseWorkspaceContinuation } from "./workspace-continuation";
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
