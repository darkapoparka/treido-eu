import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getBrowseLeafIds } from "@treido/contracts/categories";
import { readDiscoveryInput } from "../../features/catalog/discovery-input";
import { buildPublicDiscoveryQuery } from "../../features/catalog/public-discovery-sql";

it("binds a branch to its real publication leaves and keeps seller filtering independent", () => {
  for (const category of [
    "cat:garden",
    "cat:garden-diy",
    "nav:electronics/computers",
  ]) {
    const input = readDiscoveryInput({ category, seller: "business" }).input;
    const query = buildPublicDiscoveryQuery(input);
    expect(query.values).toContainEqual(getBrowseLeafIds(category));
    expect(query.values).toContain("business");
    expect(query.text).toContain("p.category_id=ANY(");
  }
});
