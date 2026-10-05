import { Buffer } from "node:buffer";
import { dirname, resolve } from "node:path";
/** Test-only transport. Production routes always use their own Clerk-verified Server Actions. */
export function createImportBrowserTransport(configuration) {
  const names = [
    "createImportUploadAction",
    "appendImportChunkAction",
    "finishImportUploadAction",
    "readCatalogueImportAction",
    "readCatalogueImportsAction",
    "changeCatalogueImportAction",
    "exportImportReportAction",
  ];
  const plugin = {
    name: "isolated-import-actions",
    enforce: "pre",
    resolveId(id, importer) {
      const p = (
        id.startsWith(".") && importer ? resolve(dirname(importer), id) : id
      ).replaceAll("\\", "/");
      if (/\/features\/catalogue-import\/actions(?:\.ts)?$/.test(p))
        return "\0import-actions";
      if (/\/features\/inventory\/index-actions(?:\.ts)?$/.test(p))
        return "\0stock-index-actions";
    },
    load(id) {
      if (!["\0import-actions", "\0stock-index-actions"].includes(id)) return;
      return (
        "async function call(name,args){const r=await fetch('/__import-action/'+name,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(args)});if(!r.ok)throw Error('Import transport failed');return r.json();}" +
        (id === "\0import-actions"
          ? names
          : [
              "readInventoryIndexAction",
              "changeStockBatchAction",
              "exportInventoryPageAction",
            ]
        )
          .map(
            (name) =>
              "export const " +
              name +
              "=(...args)=>call(" +
              JSON.stringify(name) +
              ",args);",
          )
          .join("")
      );
    },
  };
  async function handle(request, response, url) {
    if (!url.pathname.startsWith("/__import-action/")) return false;
    const send = (data) => {
      response.writeHead(200, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      response.end(JSON.stringify(data));
    };
    try {
      if (!configuration)
        throw Object.assign(new Error(), { code: "NOT_AVAILABLE" });
      const { database, api, identityForRequest } = configuration,
        actor = identityForRequest(request),
        name = url.pathname.split("/").at(-1);
      if (!actor) throw Object.assign(new Error(), { code: "UNAUTHENTICATED" });
      if (
        request.method !== "POST" ||
        ![
          ...names,
          "readInventoryIndexAction",
          "changeStockBatchAction",
          "exportInventoryPageAction",
        ].includes(name)
      )
        throw Object.assign(new Error(), { code: "INVALID_INPUT" });
      const chunks = [];
      let bytes = 0;
      for await (const chunk of request) {
        bytes += chunk.length;
        if (bytes > 220000)
          throw Object.assign(new Error(), { code: "INVALID_INPUT" });
        chunks.push(chunk);
      }
      const args = JSON.parse(Buffer.concat(chunks).toString("utf8")),
        method = name.replace(/Action$/, "");
      const data = await api[method](database, actor, ...args);
      send({ ok: true, data });
    } catch (error) {
      send({
        ok: false,
        code: [
          "INVALID_INPUT",
          "UNAUTHENTICATED",
          "FORBIDDEN",
          "NOT_FOUND",
          "CONFLICT",
          "QUOTA_EXCEEDED",
        ].includes(error.code)
          ? error.code
          : "NOT_AVAILABLE",
      });
    }
    return true;
  }
  return { plugin, handle };
}
