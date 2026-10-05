/** Native-test transport only. There is no production route or identity override. */
export function createLibraryBrowserTransport({
  database,
  api,
  identity,
} = {}) {
  const plugin = {
    name: "isolated-library-actions",
    enforce: "pre",
    resolveId(id, importer) {
      if (
        (id === "./actions" &&
          importer
            ?.replaceAll("\\", "/")
            .endsWith("/features/library/use-library.ts")) ||
        /\/features\/library\/actions(?:\.ts)?$/.test(id)
      )
        return "\0library:actions";
    },
    load(id) {
      if (id !== "\0library:actions") return;
      return "async function call(path,input){const r=await fetch('/__library/'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});if(!r.ok)throw Error('Native test transport failed');return r.json();}export const readLibraryAction=input=>call('read',input);export const changeLibraryAction=(command,query)=>call('change',{command,query});";
    },
  };
  async function handle(request, response, url) {
    if (!url.pathname.startsWith("/__library/")) return false;
    const send = (value) => {
      response.writeHead(200, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      response.end(JSON.stringify(value));
    };
    if (!identity || !api) {
      send({ ok: false, code: "UNAUTHENTICATED" });
      return true;
    }
    try {
      if (request.method !== "POST")
        throw Object.assign(new Error(), { code: "INVALID_INPUT" });
      let length = 0,
        text = "";
      for await (const part of request) {
        length += part.byteLength;
        if (length > 32768)
          throw Object.assign(new Error(), { code: "INVALID_INPUT" });
        text += part.toString("utf8");
      }
      const input = JSON.parse(text);
      if (url.pathname === "/__library/read")
        send({
          ok: true,
          data: await api.readLibrary(database, identity, input),
        });
      else if (url.pathname === "/__library/change") {
        const change = await api.changeLibrary(
          database,
          identity,
          input.command,
        );
        const query =
          input.command.operation.kind === "deleteCollection"
            ? { ...input.query, collectionId: null, cursor: null }
            : input.query;
        const view = await api.readLibrary(database, identity, query);
        send({ ok: true, data: { change, view } });
      } else send({ ok: false, code: "INVALID_INPUT" });
    } catch (error) {
      send({
        ok: false,
        code: [
          "INVALID_INPUT",
          "NOT_FOUND",
          "CONFLICT",
          "FORBIDDEN",
          "QUOTA_EXCEEDED",
          "UNAUTHENTICATED",
        ].includes(error.code)
          ? error.code
          : "NOT_AVAILABLE",
      });
    }
    return true;
  }
  return { plugin, handle };
}
