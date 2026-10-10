import { Buffer } from "node:buffer";
import { dirname, resolve } from "node:path";
/** Finite action transport for the isolated native-Postgres component journey only. */
export function createInventoryBrowserTransport(configuration) {
  const names = {
    inventory: [
      "readInventoryAction",
      "changeInventoryAction",
      "readPublicInventoryAction",
    ],
    "buyer-cart": ["readBuyerCartAction", "changeBuyerCartAction"],
    offers: ["readOffersAction", "changeOfferAction", "recoverOfferAction"],
    studio: ["searchStudioAction"],
  };
  const plugin = {
    name: "isolated-inventory-actions",
    enforce: "pre",
    resolveId(id, importer) {
      const path = (
        id.startsWith(".") && importer ? resolve(dirname(importer), id) : id
      ).replaceAll("\\", "/");
      if (
        path.endsWith("/features/sellers/studio-search-actions") ||
        path.endsWith("/features/sellers/studio-search-actions.ts")
      )
        return "\0stock:studio";
      for (const group of Object.keys(names))
        if (
          path.endsWith("/features/" + group + "/actions") ||
          path.endsWith("/features/" + group + "/actions.ts")
        )
          return "\0stock:" + group;
    },
    load(id) {
      if (!id.startsWith("\0stock:")) return;
      const group = id.slice(7);
      return (
        "async function call(name,args){const r=await fetch('/__stock-action/'+name,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(args)});if(!r.ok)throw Error('Isolated transport failed');return r.json();}" +
        names[group]
          .map(
            (name) =>
              `export const ${name}=(...args)=>call(${JSON.stringify(name)},args);`,
          )
          .join("")
      );
    },
  };
  async function handle(request, response, url) {
    if (!url.pathname.startsWith("/__stock-action/")) return false;
    const send = (data) => {
      response.writeHead(200, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      response.end(JSON.stringify(data));
    };
    if (!configuration) {
      send({ ok: false, code: "NOT_AVAILABLE" });
      return true;
    }
    const { database, api, identityForRequest } = configuration;
    let subject = null;
    try {
      if (request.method !== "POST")
        throw Object.assign(new Error(), { code: "INVALID_INPUT" });
      const buffers = [];
      let size = 0;
      for await (const part of request) {
        size += part.byteLength;
        if (size > 32768)
          throw Object.assign(new Error(), { code: "INVALID_INPUT" });
        buffers.push(part);
      }
      const args = JSON.parse(Buffer.concat(buffers).toString("utf8")),
        actor = identityForRequest(request),
        action = url.pathname.split("/").at(-1);
      subject = actor?.subject ?? null;
      let data;
      if (action === "readPublicInventoryAction") {
        data = await api.readPublicInventory(database, args[0], args[1]);
        if (!data) throw Object.assign(new Error(), { code: "NOT_FOUND" });
      } else {
        if (!actor)
          throw Object.assign(new Error(), { code: "UNAUTHENTICATED" });
        if (action === "searchStudioAction")
          data = await api.readStudioSearch(database, actor, args[0]);
        else if (action === "readInventoryAction")
          data = await api.readInventory(database, actor, args[0]);
        else if (action === "changeInventoryAction") {
          await api.changeInventory(database, actor, args[0]);
          data = await api.readInventory(database, actor, {
            sellerId: args[0].sellerId,
            listingId: args[0].listingId,
          });
        } else if (action === "readBuyerCartAction")
          data = await api.readBuyerCart(database, actor);
        else if (action === "changeBuyerCartAction") {
          if (args[1] !== actor.subject)
            throw Object.assign(new Error(), { code: "FORBIDDEN" });
          await api.changeBuyerCart(database, actor, args[0]);
          data = await api.readBuyerCart(database, actor);
        } else if (action === "readOffersAction")
          data = await api.readOffers(database, actor, args[0]);
        else if (
          action === "changeOfferAction" ||
          action === "recoverOfferAction"
        ) {
          const mutation = api.parseOfferMutation(args[0]);
          if (mutation.actorKey !== api.libraryActorKey(actor))
            throw Object.assign(new Error(), { code: "FORBIDDEN" });
          if (action === "recoverOfferAction")
            data = await api.recoverOfferRequest(database, actor, mutation);
          else {
            await api.changeOffer(database, actor, mutation.command);
            data = await api.readOffers(database, actor, {
              threadId: mutation.command.threadId,
              sellerId: mutation.command.sellerId,
            });
          }
        } else throw Object.assign(new Error(), { code: "INVALID_INPUT" });
      }
      send({ ok: true, subject, data });
    } catch (error) {
      send({
        ok: false,
        subject,
        code: [
          "INVALID_INPUT",
          "NOT_FOUND",
          "FORBIDDEN",
          "CONFLICT",
          "UNAUTHENTICATED",
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
