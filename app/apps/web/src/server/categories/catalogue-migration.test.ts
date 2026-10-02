import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCategoryCatalogueMigration,
  categoryCatalogueSnapshot,
} from "./catalogue-migration";

describe("reviewed category seed snapshot", () => {
  it("matches the immutable physical migration and owning registry", () => {
    expect(
      readFileSync(
        resolve(
          process.cwd(),
          "apps/web/migrations/0005_category_catalogue.sql",
        ),
        "utf8",
      ).replaceAll("\r\n", "\n"),
    ).toBe(buildCategoryCatalogueMigration());
    const seed = categoryCatalogueSnapshot();
    expect(
      seed.categories.filter((category) => category.kind === "root"),
    ).toHaveLength(16);
    expect(seed.policies).toHaveLength(152);
    expect(
      seed.policies.every(
        (policy) => policy.state === "pending" && !policy.enabled,
      ),
    ).toBe(true);
    expect(new Set(seed.categories.map((category) => category.id)).size).toBe(
      168,
    );
  });
});
