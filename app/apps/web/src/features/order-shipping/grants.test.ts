import { describe, expect, it } from "vitest";
import { applyOrderShippingGrants } from "./runtime-grants.mjs";
describe("shipping grants after inherited table and column permissions", () => {
  it("revokes both inherited privilege layers before any narrow grant", async () => {
    const statements: string[] = [];
    const client = {
      query: async (sql: string) => {
        statements.push(sql);
        return {
          rows: sql.startsWith("SELECT attname")
            ? [{ attname: "id" }, { attname: "payload" }]
            : [],
        };
      },
    };
    await applyOrderShippingGrants(client, "isolated_shipping_runtime");
    const firstGrant = statements.findIndex((sql) => sql.startsWith("GRANT"));
    expect(
      statements
        .slice(0, firstGrant)
        .filter((sql) => sql.startsWith("REVOKE ALL ON treido.")),
    ).toHaveLength(6);
    expect(
      statements
        .slice(0, firstGrant)
        .filter(
          (sql) =>
            sql.startsWith("REVOKE SELECT (") &&
            sql.includes("UPDATE (") &&
            sql.includes("REFERENCES ("),
        ),
    ).toHaveLength(6);
    expect(statements.slice(firstGrant).join("\n")).not.toMatch(
      /GRANT (?:SELECT,)?INSERT ON treido\.order_shipping_(?:policies|carriers|rates)/,
    );
    expect(statements.slice(firstGrant).join("\n")).not.toMatch(
      /UPDATE\([^)]*(?:value|payload|input_hash|snapshot)[^)]*\)/,
    );
  });
  it("rejects a role transport injection before any SQL", async () => {
    let calls = 0;
    await expect(
      applyOrderShippingGrants(
        {
          query: async () => {
            calls++;
            return { rows: [] };
          },
        },
        'runtime"; GRANT ALL TO PUBLIC',
      ),
    ).rejects.toThrow();
    expect(calls).toBe(0);
  });
});
