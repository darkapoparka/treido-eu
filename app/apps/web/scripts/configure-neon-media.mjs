import { AwsClient } from "aws4fetch";
import { createHash } from "node:crypto";
import { validateMediaBindings } from "../src/server/media/bindings.ts";

async function bodyText(response, maximum = 65536) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  let size = 0;
  const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new Error("Response too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}
const escapeXml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
async function main() {
  const configured = validateMediaBindings(process.env);
  if (!configured.ok) {
    console.error(
      JSON.stringify({ configured: false, variables: configured.variables }),
    );
    process.exitCode = 1;
    return;
  }
  const binding = configured.bindings;
  if (
    binding.provider !== "neon" ||
    !["development", "test"].includes(binding.purpose)
  )
    throw new Error("Use the already-qualified isolated Neon storage branch");
  const args = process.argv.slice(2);
  const apply =
    args.length === 3 &&
    args[0] === "--apply-cors" &&
    args[1] === "--branch" &&
    args[2] === process.env.TREIDO_NEON_BRANCH_ID;
  if (!apply && !(args.length === 1 && args[0] === "--check"))
    throw new Error("Use --check or --apply-cors --branch <qualified branch>");
  const client = new AwsClient({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: binding.region,
    service: "s3",
    retries: 1,
  });
  const base = binding.endpoint + "/" + binding.bucket;
  const request = async (suffix, init) =>
    fetch(await client.sign(base + suffix, init), {
      signal: AbortSignal.timeout(15000),
      redirect: "error",
      cache: "no-store",
    });
  const head = await request("", { method: "HEAD" });
  if (!head.ok) throw new Error("Private bucket access failed");
  if (apply) {
    const response = await request("?cors", { method: "GET" });
    if (!response.ok && response.status !== 404)
      throw new Error("CORS read failed");
    let xml =
      response.status === 404
        ? '<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"></CORSConfiguration>'
        : await bodyText(response);
    if (
      !xml.includes("<CORSConfiguration") ||
      !xml.includes("</CORSConfiguration>") ||
      /<!DOCTYPE|<!ENTITY/i.test(xml)
    )
      throw new Error("Unexpected CORS document; nothing changed");
    const id = "treido-" + binding.purpose + "-browser";
    // Replace only this application's named rule; preserve unrelated bucket rules.
    xml = xml.replace(/<CORSRule\b[^>]*>[\s\S]*?<\/CORSRule>/g, (rule) =>
      rule.includes("<ID>" + id + "</ID>") ? "" : rule,
    );
    const rule =
      "<CORSRule><ID>" +
      id +
      "</ID><AllowedOrigin>" +
      escapeXml(binding.origin) +
      "</AllowedOrigin><AllowedMethod>PUT</AllowedMethod><AllowedHeader>content-type</AllowedHeader><AllowedHeader>content-length</AllowedHeader><ExposeHeader>ETag</ExposeHeader><MaxAgeSeconds>300</MaxAgeSeconds></CORSRule>";
    xml = xml.replace("</CORSConfiguration>", rule + "</CORSConfiguration>");
    const updated = await request("?cors", {
      method: "PUT",
      headers: {
        "content-type": "application/xml",
        "content-length": String(Buffer.byteLength(xml)),
        "content-md5": createHash("md5").update(xml).digest("base64"),
      },
      body: xml,
    });
    await updated.body?.cancel();
    if (!updated.ok) throw new Error("CORS write failed");
  }
  const cors = await fetch(base + "/" + binding.prefix + "cors-check", {
    method: "OPTIONS",
    headers: {
      Origin: binding.origin,
      "Access-Control-Request-Method": "PUT",
      "Access-Control-Request-Headers": "content-type",
    },
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  await cors.body?.cancel();
  const allowed =
    cors.ok &&
    cors.headers.get("access-control-allow-origin") === binding.origin &&
    (cors.headers.get("access-control-allow-methods") ?? "")
      .split(/,\s*/)
      .includes("PUT");
  console.log(
    JSON.stringify({
      provider: "neon",
      branch: process.env.TREIDO_NEON_BRANCH_ID,
      bucket: binding.bucket,
      bucketAccess: "accepted",
      browserUploadCors: allowed ? "accepted" : "not-configured",
      changedCors: apply,
    }),
  );
  if (!allowed) process.exitCode = 1;
}
main().catch(() => {
  console.error(
    "Neon media configuration did not complete. Check the isolated binding and storage-only credential; provider responses and secrets are not logged.",
  );
  process.exitCode = 1;
});
