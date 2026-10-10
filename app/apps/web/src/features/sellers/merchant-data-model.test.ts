import { describe, expect, it } from "vitest";
import { parseOrderIndexQuery, literalOrderSearch, orderIndexHref } from "../payments/order-index-model";
import { parseCustomerQuery } from "./customers-model";
import { merchantCsv } from "./merchant-csv";
const id = "10000000-0000-4000-8000-000000000001";
describe("merchant operational query contracts", () => {
  it("uses finite queues and no implicit customer or seller scope", () => {
    expect(parseOrderIndexQuery({})).toEqual({ q: "", queue: "all", before: null, customerOrder: null });
    expect(parseOrderIndexQuery({ sellerId: id })).toBeNull();
    expect(parseOrderIndexQuery({ queue: "delivered" })).toBeNull();
    expect(parseCustomerQuery({ buyerId: id })).toBeNull();
  });
  it.each([{ q: ["a", "b"] }, { q: "x\n" }, { q: "x".repeat(161) }, { before: "foreign" }, { customerOrder: "user_1" }, { lang: "de" }])("rejects malformed order inputs %j", (query) => {
    expect(parseOrderIndexQuery(query)).toBeNull();
  });
  it("keeps literal wildcard and Unicode product searches", () => {
    expect(parseOrderIndexQuery({ q: "  Дълго име  ", lang: "bg" })?.q).toBe("Дълго име");
    expect(literalOrderSearch("50%_\\")).toBe("%50\\%\\_\\\\%");
  });
  it("resets pagination when changing queues and retains the current customer", () => {
    const query = { q: "Продукт", queue: "all" as const, before: id, customerOrder: id };
    const url = new URL(orderIndexHref(id, "bg", query, { queue: "financial" }), "https://treido.invalid");
    expect(url.searchParams.get("queue")).toBe("financial");
    expect(url.searchParams.get("customerOrder")).toBe(id);
    expect(url.searchParams.has("before")).toBe(false);
    expect(url.searchParams.get("q")).toBe("Продукт");
  });
  it("validates customer pagination without accepting names or emails", () => {
    expect(parseCustomerQuery({ lang: "bg", before: id })).toEqual({ before: id });
    expect(parseCustomerQuery({ email: "not-a-customer@example.invalid" })).toBeNull();
  });
});
describe("merchant CSV delivery", () => {
  it("escapes fields, preserves Bulgarian and neutralizes spreadsheet commands", () => {
    const csv = merchantCsv([["Референция", "a,b", 'a"b', "=1+1", "  @SUM(A1)", null, 120]]);
    expect(csv).toBe('\ufeff"Референция","a,b","a""b","\'=1+1","\'  @SUM(A1)","","120"\r\n');
  });
});
