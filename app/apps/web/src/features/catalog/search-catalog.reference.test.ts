import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readReferenceCatalog } from "./reference/adapter.server";
import { toSearchCatalog } from "./search-catalog";
import {
  emptyFilters,
  searchProducts,
  searchStores,
} from "../discovery/search-model";

it.each(["reference-default", undefined])(
  "preserves assembled catalog search: %s",
  async (scenario) => {
    const full = await readReferenceCatalog(scenario);
    const lean = toSearchCatalog(full);
    for (const query of ["", "jeans", "belle", "staud", "unknown"]) {
      const expected = searchProducts(full, query, emptyFilters, []);
      const actual = searchProducts(lean, query, emptyFilters, []);
      expect(actual.map((p) => p.id)).toEqual(expected.map((p) => p.id));
      expect(
        searchStores(lean, query, emptyFilters, actual).map((s) => s.id),
      ).toEqual(
        searchStores(full, query, emptyFilters, expected).map((s) => s.id),
      );
    }
    const fullBytes = Buffer.byteLength(JSON.stringify(full));
    const projectedBytes = Buffer.byteLength(JSON.stringify(lean));
    expect(projectedBytes).toBeLessThan(fullBytes);
    console.info(
      JSON.stringify({
        scenario: scenario ?? "live",
        products: full.products.length,
        stores: full.stores.length,
        fullBytes,
        projectedBytes,
      }),
    );
  },
);
