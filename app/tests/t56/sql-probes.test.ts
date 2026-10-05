import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
vi.mock("../../apps/web/node_modules/server-only/index.js", () => ({}));
import {
  SELLER_DATASETS,
  OPERATOR_DATASETS,
  parseInsightQuery,
  type SellerDataset,
  type OperatorDataset,
} from "../../apps/web/src/features/insights/model";
import { sellerInsightSource } from "../../apps/web/src/features/insights/seller-source.server";
import { operatorInsightSource } from "../../apps/web/src/features/insights/operator-source.server";
import { readInsightSource } from "../../apps/web/src/features/insights/sql.server";
import {
  buildToolQuery,
  buildComparisonFactsQuery,
} from "../../apps/web/src/features/shopping-tools/catalogue-sql.server";
import { parseToolIntent } from "../../apps/web/src/features/shopping-tools/intent";
import type { SellerTransaction } from "../../apps/web/src/server/db/database";
import { readInquiryInsightRows } from "../../apps/web/src/features/merchant-inquiries/queries.server";
import { readSearchMatchFeed } from "../../apps/web/src/features/saved-searches/feed.server";
import {
  EXPORT_SQL,
  readClosureFacts,
} from "../../apps/web/src/features/account-privacy/projections.server";

describe("T56 prepare actual feature SELECTs for separate readonly schema qualification", () => {
  it("captures fixed parameterized T51/T52 source SQL without executing it", async () => {
    const id = "00000000-0000-4000-8000-000000000001";
    const now = new Date("2026-10-04T12:00:00Z");
    const probes: {
      name: string;
      owner: string;
      text: string;
      values: unknown[];
    }[] = [];
    for (const dataset of Object.keys(SELLER_DATASETS) as SellerDataset[]) {
      if (dataset === "inquiries") continue;
      const scope = { kind: "seller", sellerId: id } as const;
      const query = parseInsightQuery({ dataset }, scope, now);
      const client = {
        query: vi.fn(async (text: string, values: unknown[]) => {
          probes.push({
            name: "T51-seller-" + dataset,
            owner: "features/insights/seller-source.server.ts",
            text,
            values,
          });
          return { rows: [] };
        }),
      };
      await readInsightSource(
        { client } as unknown as SellerTransaction,
        sellerInsightSource(id, dataset),
        query,
        2000,
      );
    }
    for (const dataset of Object.keys(OPERATOR_DATASETS) as OperatorDataset[]) {
      const scope = { kind: "operator" } as const;
      const query = parseInsightQuery({ dataset }, scope, now);
      const client = {
        query: vi.fn(async (text: string, values: unknown[]) => {
          probes.push({
            name: "T51-operator-" + dataset,
            owner: "features/insights/operator-source.server.ts",
            text,
            values,
          });
          return { rows: [] };
        }),
      };
      await readInsightSource(
        { client } as unknown as SellerTransaction,
        operatorInsightSource(dataset, true),
        query,
        2000,
      );
    }
    for (const [name, input, mode] of [
      [
        "finder",
        "q=phone&seller=personal&condition=good&maxPrice=100&location=София",
        "find-for-me",
      ],
      [
        "deals-stock",
        "category=cat%3Aelectronics%2Fphones&attr.storageGB=128&availability=known&handover=shipping&maxPrice=200",
        "deal-finder",
      ],
    ] as const) {
      const query = buildToolQuery(parseToolIntent(input, mode), null);
      probes.push({
        name: "T52-" + name,
        owner: "features/shopping-tools/catalogue-sql.server.ts",
        ...query,
      });
    }
    probes.push({
      name: "T52-comparison-facts",
      owner: "features/shopping-tools/catalogue-sql.server.ts",
      ...buildComparisonFactsQuery([id]),
    });
    const inquiryClient = {
      query: vi.fn(async (text: string, values: unknown[]) => {
        probes.push({
          name: "T51-seller-inquiries",
          owner: "features/merchant-inquiries/queries.server.ts",
          text,
          values,
        });
        return { rows: [] };
      }),
    };
    await readInquiryInsightRows(
      { client: inquiryClient } as unknown as SellerTransaction,
      id,
      {
        from: "2026-10-01T00:00:00Z",
        until: "2026-10-05T00:00:00Z",
        status: "all",
        q: "",
        limit: 2000,
      },
    );
    const feedClient = {
      query: vi.fn(async (text: string, values: unknown[] = []) => {
        probes.push({
          name:
            "T53-feed-" +
            probes.filter((probe) => probe.name.startsWith("T53-feed")).length,
          owner: "features/saved-searches/feed.server.ts",
          text,
          values,
        });
        if (text.includes("to_regclass")) return { rows: [{ ready: true }] };
        if (text.includes("statement_timestamp() AT TIME ZONE"))
          return { rows: [{ at: "2026-10-04T12:00:00.000000Z" }] };
        if (text.includes("count(*)")) return { rows: [{ count: 0 }] };
        return { rows: [] };
      }),
    };
    await readSearchMatchFeed(
      { client: feedClient } as unknown as SellerTransaction,
      id,
      "a".repeat(64),
      { filter: "all", q: "", cursor: null },
    );
    for (const [category, text] of Object.entries(EXPORT_SQL))
      probes.push({
        name: "T55-export-" + category,
        owner: "features/account-privacy/projections.server.ts",
        text,
        values: [id, 51],
      });
    const closureClient = {
      query: vi.fn(async (text: string, values: unknown[]) => {
        probes.push({
          name: "T55-closure-facts",
          owner: "features/account-privacy/projections.server.ts",
          text,
          values,
        });
        return { rows: [{}] };
      }),
    };
    await readClosureFacts(
      closureClient as unknown as Pick<SellerTransaction["client"], "query">,
      id,
    );
    const sourceFiles = [
      "features/insights/seller-source.server.ts",
      "features/insights/operator-source.server.ts",
      "features/insights/sql.server.ts",
      "features/shopping-tools/catalogue-sql.server.ts",
      "features/merchant-inquiries/queries.server.ts",
      "features/saved-searches/feed.server.ts",
      "features/account-privacy/projections.server.ts",
    ];
    const workspaceRoot = path.resolve(import.meta.dirname, "../..");
    const sourceHashes = Object.fromEntries(
      sourceFiles.map((file) => [
        file,
        createHash("sha256")
          .update(
            fs.readFileSync(path.resolve(workspaceRoot, "apps/web/src", file)),
          )
          .digest("hex"),
      ]),
    );
    const output = path.resolve(workspaceRoot, "../.qa/t56/sql-probes.json");
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(
      output,
      JSON.stringify(
        {
          syntheticParameters: true,
          readOnlyExplainOnly: true,
          sourceHashes,
          probes,
        },
        null,
        2,
      ),
    );
    expect(probes).toHaveLength(29);
    expect(
      probes.every(
        (probe) => !/\b(INSERT|UPDATE|DELETE|ALTER|CREATE)\b/i.test(probe.text),
      ),
    ).toBe(true);
  });
});
