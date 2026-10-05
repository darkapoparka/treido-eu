import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID, createHash, randomBytes } from "node:crypto";
import { Pool } from "pg";
import { createDatabase, inTransaction } from "../../server/db/database";
import {
  createBusinessSeller,
  ensurePersonalSeller,
  readSellerContext,
  revokeSellerMembership,
  authorizeHuman,
} from "../sellers/persistence.server";
import { readListingDraft } from "../selling/drafts.server";
import { readInventory } from "../inventory/queries.server";
import { readDiscoveryInput } from "../catalog/discovery-input";
import { changeInventory } from "../inventory/commands.server";
import { readInventoryIndex } from "../inventory/index.server";
import { changeStockBatch } from "../inventory/batch.server";
import { exportInventoryPage } from "../inventory/export.server";
import {
  createImportUpload,
  appendImportChunk,
  finishImportUpload,
} from "./upload.server";
import { readCatalogueImport, readCatalogueImports } from "./queries.server";
import { changeCatalogueImport } from "./commands.server";
import { processCatalogueImport, expireImportUploads } from "./process.server";
import { exportImportReport } from "./export.server";
import { executeJob } from "../../server/jobs/execution.server";
import { CSV_COLUMNS, CSV_LIMITS, csvDocument } from "./csv";
import type { ImportCommand } from "./model";
import type { PublicationFixtureContext } from "../../../tests/fixtures/publication-flow";
export function defineImportIntegrationCases(
  get: () => PublicationFixtureContext,
) {
  describe("durable business CSV imports and seller inventory index", () => {
    let priorKey: string | undefined;
    beforeAll(() => {
      priorKey = process.env.TREIDO_DISCOVERY_CURSOR_KEY;
      process.env.TREIDO_DISCOVERY_CURSOR_KEY = randomBytes(32).toString("hex");
    });
    afterAll(() => {
      if (priorKey === undefined)
        delete process.env.TREIDO_DISCOVERY_CURSOR_KEY;
      else process.env.TREIDO_DISCOVERY_CURSOR_KEY = priorKey;
    });
    const fresh = () =>
      createBusinessSeller(get().database, get().owner, {
        name: "CSV catalogue",
        requestId: randomUUID(),
      });
    const sample = (
      external = "row-" + randomUUID(),
      sku = "sku-" + randomUUID(),
    ) => ({
      external_id: external,
      title: "Телефон София",
      description: "Описание, запазено от CSV",
      category_id: "cat:electronics/phones",
      condition: "good",
      price: "129.50",
      currency: "EUR",
      locality: "София",
      inventory_mode: "stocked",
      quantity: "3",
      sku,
      attributes_json: JSON.stringify({
        brand: "Apple",
        model: "iPhone",
        storageGB: 128,
        workingStatus: "working",
      }),
      options_json: '{"Color":"Blue"}',
    });
    const begin = async (
      sellerId: string,
      rows: ReturnType<typeof sample>[],
      actor = get().owner,
    ) => {
      const csv = csvDocument(
          CSV_COLUMNS,
          rows.map((row) => CSV_COLUMNS.map((key) => row[key])),
        ),
        bytes = Buffer.from(csv, "utf8"),
        input = {
          sellerId,
          requestId: randomUUID(),
          name: "products.csv",
          bytes: bytes.length,
          checksum: createHash("sha256").update(bytes).digest("hex"),
        };
      const upload = await createImportUpload(get().database, actor, input);
      return { sellerId, importId: upload.id, bytes, input, rows };
    };
    const stage = async (
      upload: Awaited<ReturnType<typeof begin>>,
      actor = get().owner,
    ) => {
      for (
        let position = 0;
        position < Math.ceil(upload.bytes.length / CSV_LIMITS.chunkBytes);
        position++
      )
        await appendImportChunk(get().database, actor, {
          sellerId: upload.sellerId,
          importId: upload.importId,
          position,
          encoded: upload.bytes
            .subarray(
              position * CSV_LIMITS.chunkBytes,
              (position + 1) * CSV_LIMITS.chunkBytes,
            )
            .toString("base64"),
        });
      await finishImportUpload(get().database, actor, {
        sellerId: upload.sellerId,
        importId: upload.importId,
      });
      return readCatalogueImport(get().database, actor, {
        sellerId: upload.sellerId,
        importId: upload.importId,
      });
    };
    const command = async (
      upload: { sellerId: string; importId: string },
      operation: ImportCommand["operation"],
      actor = get().owner,
    ) => {
      const view = await readCatalogueImport(get().database, actor, upload);
      return changeCatalogueImport(get().database, actor, {
        ...upload,
        expectedRevision: view.revision,
        requestId: randomUUID(),
        operation,
      });
    };
    const execute = async (upload: { sellerId: string; importId: string }) => {
      const job = (
        await get().admin.query(
          "SELECT job_id FROM treido.catalogue_imports WHERE id=$1",
          [upload.importId],
        )
      ).rows[0].job_id;
      return executeJob(
        get().database,
        {
          jobId: job,
          sellerId: upload.sellerId,
          generation: 1,
          schemaVersion: 1,
          environment: "test",
          applicationId: "treido-import-test",
        },
        { environment: "test", applicationId: "treido-import-test" },
        randomUUID(),
        {
          "catalogue.import": (effect) =>
            processCatalogueImport(get().database, effect),
        },
      );
    };
    const finish = async (upload: { sellerId: string; importId: string }) => {
      for (let count = 0; count < 12; count++) {
        const view = await readCatalogueImport(get().database, get().owner, {
          sellerId: upload.sellerId,
          importId: upload.importId,
        });
        if (!["queued", "processing"].includes(view.state)) return view;
        await execute(upload);
      }
      throw Error("Import did not finish");
    };
    it("resumes chunked UTF-8 upload, validates rows and removes temporary upload bytes", async () => {
      const seller = await fresh(),
        upload = await begin(
          seller,
          Array.from({ length: 24 }, () => ({
            ...sample(),
            description: "Д".repeat(5900),
          })),
        );
      expect(upload.bytes.length).toBeGreaterThan(CSV_LIMITS.chunkBytes);
      expect(
        (await createImportUpload(get().database, get().owner, upload.input))
          .id,
      ).toBe(upload.importId);
      const first = {
        sellerId: seller,
        importId: upload.importId,
        position: 0,
        encoded: upload.bytes
          .subarray(0, CSV_LIMITS.chunkBytes)
          .toString("base64"),
      };
      await appendImportChunk(get().database, get().owner, first);
      await appendImportChunk(get().database, get().owner, first);
      expect(
        (
          await readCatalogueImport(get().database, get().owner, {
            sellerId: seller,
            importId: upload.importId,
          })
        ).uploaded,
      ).toEqual([0]);
      await expect(
        finishImportUpload(get().database, get().owner, {
          sellerId: seller,
          importId: upload.importId,
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const view = await stage(upload);
      expect(view).toMatchObject({
        state: "review",
        total: 24,
        ready: 24,
        created: 0,
        rowLimit: 25,
      });
      expect(
        (
          await get().admin.query(
            "SELECT count(*)::int AS count FROM treido.catalogue_import_chunks WHERE import_id=$1",
            [upload.importId],
          )
        ).rows[0].count,
      ).toBe(0);
      expect(
        (
          await get().admin.query(
            "SELECT count(*)::int AS count FROM treido.listings WHERE seller_id=$1",
            [seller],
          )
        ).rows[0].count,
      ).toBe(0);
    });
    it("creates real drafts and stock in bounded replay-safe batches and persists to a new connection", async () => {
      const seller = await fresh(),
        upload = await begin(
          seller,
          Array.from({ length: 7 }, () => sample()),
        );
      await stage(upload);
      const view = await readCatalogueImport(get().database, get().owner, {
        sellerId: seller,
        importId: upload.importId,
      });
      const start = {
        sellerId: seller,
        importId: upload.importId,
        requestId: randomUUID(),
        expectedRevision: view.revision,
        operation: { kind: "start" },
      };
      const accepted = await changeCatalogueImport(
        get().database,
        get().owner,
        start,
      );
      expect(
        await changeCatalogueImport(get().database, get().owner, start),
      ).toEqual(accepted);
      await execute(upload);
      expect(
        (
          await readCatalogueImport(get().database, get().owner, {
            sellerId: seller,
            importId: upload.importId,
          })
        ).created,
      ).toBe(5);
      const done = await finish(upload);
      expect(done).toMatchObject({ state: "completed", created: 7 });
      const freshDb = createDatabase(new Pool(get().database.pool.options));
      try {
        const persisted = await readCatalogueImport(freshDb, get().owner, {
          sellerId: seller,
          importId: upload.importId,
        });
        expect(persisted.created).toBe(7);
        const draft = await readListingDraft(
          freshDb,
          get().owner,
          seller,
          persisted.rows[0].listingId!,
        );
        expect(draft).toMatchObject({
          publication: "draft",
          payload: { title: "Телефон София", priceMinor: 12950 },
        });
        expect(
          (
            await readInventory(freshDb, get().owner, {
              sellerId: seller,
              listingId: draft.id,
            })
          ).skus[0],
        ).toMatchObject({ onHand: 3, options: { Color: "Blue" } });
      } finally {
        await freshDb.pool.end();
      }
      await expect(
        changeCatalogueImport(get().database, get().owner, start),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        (
          await get().admin.query(
            "SELECT draft_count FROM treido.seller_usage WHERE seller_id=$1",
            [seller],
          )
        ).rows[0].draft_count,
      ).toBe(7);
    });
    it("requires explicit Free-plan selection and never takes a twenty-sixth row", async () => {
      const seller = await fresh(),
        upload = await begin(
          seller,
          Array.from({ length: 26 }, () => sample()),
        );
      await stage(upload);
      await expect(
        command(
          { sellerId: seller, importId: upload.importId },
          { kind: "start" },
        ),
      ).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
      await command(
        { sellerId: seller, importId: upload.importId },
        { kind: "choose_valid", count: 25 },
      );
      await command(
        { sellerId: seller, importId: upload.importId },
        { kind: "start" },
      );
      expect(await finish(upload)).toMatchObject({
        created: 25,
        state: "completed",
        ready: 1,
      });
    });
    it("flags duplicate external IDs and invalid fields, supports correction, and deduplicates across files", async () => {
      const seller = await fresh(),
        same = "external-" + randomUUID(),
        row = sample(same),
        upload = await begin(seller, [
          row,
          { ...sample(same), price: "wrong" },
        ]);
      const staged = await stage(upload);
      expect(staged.invalid).toBe(2);
      await command(
        { sellerId: seller, importId: upload.importId },
        { kind: "edit", row: 2, raw: sample() },
      );
      let updated = await readCatalogueImport(get().database, get().owner, {
        sellerId: seller,
        importId: upload.importId,
      });
      expect(updated.ready).toBe(2);
      await command(
        { sellerId: seller, importId: upload.importId },
        { kind: "choose_valid", count: 2 },
      );
      await command(
        { sellerId: seller, importId: upload.importId },
        { kind: "start" },
      );
      await finish(upload);
      const second = await begin(seller, [sample(same)]);
      updated = await stage(second);
      expect(updated.rows[0].errors).toContainEqual({
        field: "external_id",
        code: "already_imported",
      });
    });
    it("rolls back a failed stock row without leaving an orphan draft or consuming quota", async () => {
      const seller = await fresh(),
        sku = "duplicate-" + randomUUID(),
        upload = await begin(seller, [
          sample(undefined, sku),
          sample(undefined, sku),
        ]);
      await stage(upload);
      await command(
        { sellerId: seller, importId: upload.importId },
        { kind: "start" },
      );
      const done = await finish(upload);
      expect(done).toMatchObject({ state: "paused", created: 1, invalid: 1 });
      expect(
        (
          await get().admin.query(
            "SELECT draft_count FROM treido.seller_usage WHERE seller_id=$1",
            [seller],
          )
        ).rows[0].draft_count,
      ).toBe(1);
      expect(
        (
          await get().admin.query(
            "SELECT count(*)::int AS count FROM treido.listings WHERE seller_id=$1",
            [seller],
          )
        ).rows[0].count,
      ).toBe(1);
      await command(
        { sellerId: seller, importId: upload.importId },
        { kind: "edit", row: 2, raw: sample() },
      );
      await command(
        { sellerId: seller, importId: upload.importId },
        { kind: "start" },
      );
      expect(await finish(upload)).toMatchObject({
        state: "completed",
        created: 2,
      });
    });
    it("cancels remaining batches while preserving committed drafts and blocks an old worker", async () => {
      const seller = await fresh(),
        upload = await begin(
          seller,
          Array.from({ length: 8 }, () => sample()),
        );
      await stage(upload);
      await command(
        { sellerId: seller, importId: upload.importId },
        { kind: "start" },
      );
      await execute(upload);
      await command(
        { sellerId: seller, importId: upload.importId },
        { kind: "cancel" },
      );
      expect(await execute(upload)).toMatchObject({ status: "cancelled" });
      expect(
        await readCatalogueImport(get().database, get().owner, {
          sellerId: seller,
          importId: upload.importId,
        }),
      ).toMatchObject({ state: "cancelled", created: 5 });
    });
    it("enforces human, seller, personal and revoked-member boundaries on reads and jobs", async () => {
      const ctx = get(),
        seller = await fresh(),
        other = { subject: "user_csv_" + randomUUID().replaceAll("-", "") };
      const user = await inTransaction(ctx.database, (tx) =>
        authorizeHuman(tx, other, true),
      );
      const personal = await ensurePersonalSeller(ctx.database, other);
      await expect(begin(personal, [sample()], other)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      const upload = await begin(seller, [sample()]);
      await stage(upload);
      await expect(
        readCatalogueImport(ctx.database, other, {
          sellerId: seller,
          importId: upload.importId,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await ctx.admin.query(
        "INSERT INTO treido.seller_memberships(seller_id,user_id,role,grants) VALUES($1,$2,'manager','[\"import.run\"]')",
        [seller, user.id],
      );
      await command(
        { sellerId: seller, importId: upload.importId },
        { kind: "start" },
        other,
      );
      await revokeSellerMembership(ctx.database, ctx.owner, {
        sellerId: seller,
        userId: user.id,
      });
      expect(await execute(upload)).toMatchObject({ status: "cancelled" });
      expect(
        (
          await readCatalogueImport(ctx.database, ctx.owner, {
            sellerId: seller,
            importId: upload.importId,
          })
        ).created,
      ).toBe(0);
      await expect(
        exportImportReport(ctx.database, other, {
          sellerId: seller,
          importId: upload.importId,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("expires abandoned bytes without deleting reviewed history and prevents ownership/receipt rewriting", async () => {
      const ctx = get(),
        seller = await fresh(),
        upload = await begin(seller, [sample()]);
      await appendImportChunk(ctx.database, ctx.owner, {
        sellerId: seller,
        importId: upload.importId,
        position: 0,
        encoded: upload.bytes.toString("base64"),
      });
      await ctx.admin.query(
        "UPDATE treido.catalogue_imports SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
        [upload.importId],
      );
      expect((await expireImportUploads(ctx.database)).expired).toBeGreaterThan(
        0,
      );
      expect(
        (
          await readCatalogueImport(ctx.database, ctx.owner, {
            sellerId: seller,
            importId: upload.importId,
          })
        ).state,
      ).toBe("cancelled");
      await expect(
        ctx.database.pool.query(
          "UPDATE treido.catalogue_imports SET created_by=created_by",
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        ctx.database.pool.query(
          "UPDATE treido.catalogue_import_receipts SET accepted_revision=1",
        ),
      ).rejects.toMatchObject({ code: "42501" });
      const index = await readCatalogueImports(ctx.database, ctx.owner, {
        sellerId: seller,
      });
      expect(index.items).toHaveLength(1);
    });
    it("reads seller-wide stock, literal SKU search, unconfigured items and tenant-bound pages", async () => {
      const seller = await fresh(),
        upload = await begin(seller, [
          sample(undefined, "literal%_SKU"),
          {
            ...sample(),
            inventory_mode: "",
            quantity: "",
            sku: "",
            options_json: "",
          },
        ]);
      await stage(upload);
      await command(
        { sellerId: seller, importId: upload.importId },
        { kind: "start" },
      );
      await finish(upload);
      const view = await readInventoryIndex(
        get().database,
        get().owner,
        seller,
        { q: "%_" },
      );
      expect(view.items).toHaveLength(1);
      expect(view.items[0]).toMatchObject({
        available: 3,
        sellerSku: "literal%_SKU",
      });
      expect(
        (
          await readInventoryIndex(get().database, get().owner, seller, {
            status: "unknown",
          })
        ).items,
      ).toHaveLength(1);
      expect(
        (
          await readInventoryIndex(
            get().database,
            get().owner,
            await fresh(),
            {},
          )
        ).total,
      ).toBe(0);
    });
    it("serializes two queued imports at the final draft slot without losing either receipt", async () => {
      const sellerId = await fresh(),
        a = await begin(sellerId, [sample()]),
        b = await begin(sellerId, [sample()]);
      await stage(a);
      await stage(b);
      await get().admin.query(
        "UPDATE treido.seller_usage SET draft_count=199 WHERE seller_id=$1",
        [sellerId],
      );
      await command({ sellerId, importId: a.importId }, { kind: "start" });
      await command({ sellerId, importId: b.importId }, { kind: "start" });
      await Promise.all([execute(a), execute(b)]);
      const results = await Promise.all(
        [a, b].map((row) =>
          readCatalogueImport(get().database, get().owner, {
            sellerId,
            importId: row.importId,
          }),
        ),
      );
      expect(results.map((row) => row.created).sort()).toEqual([0, 1]);
      expect(results.map((row) => row.state).sort()).toEqual([
        "completed",
        "paused",
      ]);
      expect(
        (
          await get().admin.query(
            "SELECT draft_count FROM treido.seller_usage WHERE seller_id=$1",
            [sellerId],
          )
        ).rows[0].draft_count,
      ).toBe(200);
    });
    it("enforces the Free variant limit and paginates a real multi-product stock catalogue", async () => {
      const sellerId = await fresh(),
        upload = await begin(sellerId, [sample(), sample()]);
      await stage(upload);
      await command({ sellerId, importId: upload.importId }, { kind: "start" });
      const done = await finish(upload);
      for (const row of done.rows) {
        let view = await readInventory(get().database, get().owner, {
          sellerId,
          listingId: row.listingId,
        });
        for (let number = 1; number < 25; number++) {
          await changeInventory(get().database, get().owner, {
            sellerId,
            listingId: row.listingId,
            expectedRevision: view.revision,
            requestId: randomUUID(),
            operation: {
              kind: "variant",
              skuId: null,
              sellerSku: "",
              options: { Color: "Shade " + number },
              priceMinor: null,
              onHand: 1,
            },
          });
          view = await readInventory(get().database, get().owner, {
            sellerId,
            listingId: row.listingId,
          });
        }
        expect(view.maxVariants).toBe(25);
        await expect(
          changeInventory(get().database, get().owner, {
            sellerId,
            listingId: row.listingId,
            expectedRevision: view.revision,
            requestId: randomUUID(),
            operation: {
              kind: "variant",
              skuId: null,
              sellerSku: "",
              options: { Color: "Over limit" },
              priceMinor: null,
              onHand: 1,
            },
          }),
        ).rejects.toMatchObject({ code: "CONFLICT" });
      }
      const first = await readInventoryIndex(
          get().database,
          get().owner,
          sellerId,
          {},
        ),
        second = await readInventoryIndex(
          get().database,
          get().owner,
          sellerId,
          { cursor: first.nextCursor },
        );
      expect(first.total).toBe(50);
      expect(first.items).toHaveLength(30);
      expect(second.items).toHaveLength(20);
      expect(
        new Set([...first.items, ...second.items].map((row) => row.skuId)).size,
      ).toBe(50);
      await expect(
        readInventoryIndex(get().database, get().owner, sellerId, {
          q: "changed",
          cursor: first.nextCursor,
        }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    });
    it.skipIf(process.env.TREIDO_IMPORT_BROWSER !== "1")(
      "uses the actual importer and seller-wide stock screens",
      async () => {
        const sellerId = await fresh(),
          rows = [sample(), { ...sample(), price: "bad" }];
        const csv = csvDocument(
          CSV_COLUMNS,
          rows.map((row) => CSV_COLUMNS.map((key) => row[key])),
        );
        const { runImportBrowser } =
          await import("../../../../../tests/import-flow-browser.mjs");
        await runImportBrowser({
          database: get().database,
          owner: get().owner,
          sellerId,
          csv,
          drain: finish,
          api: {
            readDiscoveryInput,
            readSellerContext,
            readCatalogueImports,
            readCatalogueImport,
            createImportUpload,
            appendImportChunk,
            finishImportUpload,
            changeCatalogueImport,
            exportImportReport,
            readInventoryIndex,
            changeStockBatch,
            exportInventoryPage,
            readInventory,
            changeInventory,
          },
        });
      },
      120000,
    );
  });
}
