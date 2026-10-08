import { describe, expect, it } from "vitest";
import {
  browseScopeHref,
  discoveryDestination,
  discoveryDockDestination,
  referenceSearchDestination,
} from "./browse-scope-route";

const input = new URLSearchParams(
  "q=телефон&category=cat%3Aelectronics%2Fphones&seller=personal&condition=good&minPrice=12.34&maxPrice=90&location=София&lang=en&sort=price_asc&attr.brand=Samsung&sellerId=foreign&page=9",
);
describe("public browse routing", () => {
  it.each(["/", "/explore"])(
    "dock %s starts afresh while retaining seller scope and language",
    (path) => {
      const url = new URL(
        discoveryDockDestination(path, input),
        "https://treido.invalid",
      );
      expect(url.pathname).toBe(path);
      expect(Object.fromEntries(url.searchParams)).toEqual({
        seller: "personal",
        lang: "en",
      });
    },
  );
  it("dock Search retains the current criteria and Home retains only an authored recent mode", () => {
    const search = new URL(
      discoveryDockDestination("/search", input),
      "https://treido.invalid",
    );
    expect(search.searchParams.get("category")).toBe("cat:electronics/phones");
    expect(search.searchParams.get("condition")).toBe("good");
    expect(search.searchParams.get("minPrice")).toBe("12.34");
    expect(discoveryDockDestination("/?home=recent", input)).toBe(
      "/?home=recent&seller=personal&lang=en",
    );
    expect(
      discoveryDockDestination(
        "/explore",
        new URLSearchParams(
          "seller=invalid&lang=bad&category=cat%3Aelectronics",
        ),
      ),
    ).toBe("/explore");
    expect(discoveryDestination("/products/item", input)).toContain(
      "category=cat%3Aelectronics%2Fphones",
    );
  });
  it("keeps explicit Bulgarian against a different saved/browser default", () => {
    const source = new URLSearchParams("lang=bg&location=София");
    expect(browseScopeHref("/search", source, "business")).toContain("lang=bg");
    expect(discoveryDestination("/products/item", source)).toContain("lang=bg");
    expect(discoveryDockDestination("/explore", source)).toBe(
      "/explore?lang=bg",
    );
  });
  it("preserves canonical context and drops pagination and operating seller input", () => {
    const url = new URL(
      browseScopeHref("/search", input, "business"),
      "https://treido.invalid",
    );
    expect(url.searchParams.get("seller")).toBe("business");
    for (const key of [
      "q",
      "category",
      "condition",
      "location",
      "lang",
      "sort",
      "attr.brand",
    ])
      expect(url.searchParams.get(key)).toBe(input.get(key));
    expect(url.searchParams.get("minPrice")).toBe("12.34");
    expect(url.searchParams.get("maxPrice")).toBe("90.00");
    expect(url.searchParams.has("sellerId")).toBe(false);
    expect(url.searchParams.has("page")).toBe(false);
  });
  it("All is an explicit reset, invalid or missing scope normalizes to All", () => {
    expect(browseScopeHref("/search", input, "all")).not.toContain("seller=");
    expect(
      browseScopeHref("/search", new URLSearchParams("seller=manager"), "all"),
    ).toBe("/search");
  });
  it("carries context through public details, storefronts, categories and assistants", () => {
    for (const href of [
      "/products/item",
      "/stores/shop/search",
      "/explore",
      "/assistant",
      "/minis/find",
    ])
      expect(
        new URL(
          discoveryDestination(href, input),
          "https://treido.invalid",
        ).searchParams.get("seller"),
      ).toBe("personal");
    const url = new URL(
      discoveryDestination(
        "/search?q=coat&category=cat%3Afashion%2Fwomen&attr.size=M&attr.size=L",
        input,
      ),
      "https://treido.invalid",
    );
    expect(url.searchParams.get("q")).toBe("coat");
    expect(url.searchParams.getAll("attr.size")).toEqual(["M", "L"]);
  });
  it("leaves private, saved, commerce and external destinations unchanged", () => {
    for (const href of [
      "/app?sellerId=owned",
      "/sell",
      "/profile",
      "/saved",
      "/orders",
      "/cart",
      "https://example.com",
      "//example.com",
      "javascript:alert(1)",
    ])
      expect(discoveryDestination(href, input)).toBe(href);
  });
  it("preserves default reference URLs when there is no discovery context", () => {
    expect(
      discoveryDestination(
        "/stores/store?collection=new#items",
        new URLSearchParams(),
      ),
    ).toBe("/stores/store?collection=new#items");
  });
  it("keeps canonical filters when reference sheet or query changes", () => {
    const next = referenceSearchDestination(
      input,
      new URLSearchParams("q=coat&color=Blue"),
    );
    expect(next.get("seller")).toBe("personal");
    expect(next.get("condition")).toBe("good");
    expect(next.get("minPrice")).toBe("12.34");
    expect(next.get("q")).toBe("coat");
    expect(next.get("category")).toBe("cat:electronics/phones");
    expect(next.get("sort")).toBe("price_asc");
    expect(next.has("page")).toBe(false);
  });
  it("can clear legacy sheet values without dropping canonical state", () => {
    const next = referenceSearchDestination(
      new URLSearchParams(
        "seller=business&category=Pants&sort=Highest+→+Lowest+Price&color=Blue",
      ),
      new URLSearchParams("q=jeans"),
    );
    expect(next.toString()).toBe("seller=business&q=jeans");
  });
});
