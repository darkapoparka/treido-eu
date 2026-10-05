import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash, randomBytes } from "node:crypto";
vi.mock("server-only", () => ({}));
import { validateMediaBindings, type MediaBindings } from "./bindings";
import { createS3Storage } from "./storage.server";
const branch = "br-library-media-fixture";
const region = "eu-central-1";
const endpoint =
  "https://" + branch + ".storage.c-5." + region + ".aws.neon.tech";
const environment = () => ({
  TREIDO_MEDIA_PROVIDER: "neon",
  TREIDO_ENV: "test",
  TREIDO_MEDIA_PURPOSE: "test",
  TREIDO_MEDIA_BUCKET: "treido-fixture-media",
  TREIDO_MEDIA_PREFIX: "test-media/",
  AWS_ENDPOINT_URL_S3: endpoint,
  AWS_REGION: region,
  TREIDO_DB_REGION: "aws-" + region,
  AWS_ACCESS_KEY_ID: "nak_live_" + randomBytes(16).toString("hex"),
  AWS_SECRET_ACCESS_KEY: "nsk_live_" + randomBytes(32).toString("hex"),
  TREIDO_APP_ORIGIN: "http://localhost:6419",
  TREIDO_NEON_BRANCH_ID: branch,
});
const binding: MediaBindings = {
  provider: "neon",
  region,
  endpoint,
  bucket: "treido-fixture-media",
  prefix: "test-media/",
  accountId: "",
  purpose: "test",
  origin: "http://localhost:6419",
};
const storage = () =>
  createS3Storage(binding, {
    accessKeyId: "nak_live_" + randomBytes(16).toString("hex"),
    secretAccessKey: "nsk_live_" + randomBytes(32).toString("hex"),
  });
afterEach(() => vi.unstubAllGlobals());
describe("Neon private media adapter", () => {
  it("binds the same declared branch, region and environment without accepting arbitrary S3 hosts", () => {
    const env = environment();
    expect(validateMediaBindings(env)).toMatchObject({
      ok: true,
      bindings: binding,
    });
    for (const invalid of [
      { ...env, AWS_ENDPOINT_URL_S3: "https://example.com" },
      { ...env, TREIDO_NEON_BRANCH_ID: "br-other-branch" },
      { ...env, AWS_REGION: "eu-west-1" },
      { ...env, TREIDO_MEDIA_PURPOSE: "production" },
      { ...env, NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY: "forbidden" },
    ])
      expect(validateMediaBindings(invalid).ok).toBe(false);
  });
  it("signs path-style uploads for the actual Neon region and declared bytes", async () => {
    const upload = await storage().upload("test-media/staging/a/b", {
      contentType: "image/png",
      bytes: 123,
    });
    const url = new URL(upload.url);
    expect(url.origin).toBe(endpoint);
    expect(url.pathname).toBe("/treido-fixture-media/test-media/staging/a/b");
    expect(url.searchParams.get("X-Amz-Credential")).toContain(
      "/eu-central-1/s3/aws4_request",
    );
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain(
      "content-length",
    );
    expect(upload.headers).toEqual({ "content-type": "image/png" });
  });
  it("freezes only checksum-verified bytes into a unique private destination without R2 copy extensions", async () => {
    const bytes = Buffer.from("bounded private fixture bytes"),
      etag = '"' + createHash("md5").update(bytes).digest("hex") + '"';
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(bytes, {
          headers: { etag, "content-length": String(bytes.length) },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    await storage().freeze(
      "test-media/staging/a/b",
      etag,
      "test-media/immutable/a/b/unique",
      createHash("sha256").update(bytes).digest("hex"),
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
    const read = fetcher.mock.calls[0][0] as Request,
      write = fetcher.mock.calls[1][0] as Request;
    expect(read.headers.get("if-match")).toBe(etag);
    expect(write.method).toBe("PUT");
    expect(write.headers.has("cf-copy-destination-if-none-match")).toBe(false);
    expect(Buffer.from(await write.arrayBuffer())).toEqual(bytes);
  });
  it("rejects changed objects and never writes a failed checksum", async () => {
    const bytes = Buffer.from("changed"),
      etag = '"' + "a".repeat(32) + '"';
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(bytes, {
        headers: { etag, "content-length": String(bytes.length) },
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    await expect(
      storage().freeze(
        "test-media/staging/a/b",
        etag,
        "test-media/immutable/a/b/unique",
        "0".repeat(64),
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockReset().mockResolvedValue(
      new Response(bytes, {
        headers: {
          etag: '"' + "b".repeat(32) + '"',
          "content-length": String(bytes.length),
        },
      }),
    );
    await expect(
      storage().freeze(
        "test-media/staging/a/b",
        etag,
        "test-media/immutable/a/b/unique",
        "0".repeat(64),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

it("acknowledges only signed unversioned deletion in the bound bucket", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetcher);
  const current = storage();
  expect(current.scope).toBe(storage().scope);
  await current.remove("test-media/staging/owned/photo");
  const request = fetcher.mock.calls[0][0] as Request;
  expect(request.method).toBe("DELETE");
  expect(request.headers.get("authorization")).toContain("AWS4-HMAC-SHA256");
  expect(new URL(request.url).pathname).toBe(
    "/treido-fixture-media/test-media/staging/owned/photo",
  );
  await expect(current.remove("another-project/photo")).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
  fetcher.mockResolvedValue(
    new Response(null, {
      status: 204,
      headers: {
        "x-amz-delete-marker": "true",
        "x-amz-version-id": "version-1",
      },
    }),
  );
  await expect(
    current.remove("test-media/staging/owned/photo"),
  ).rejects.toMatchObject({ code: "NOT_AVAILABLE" });
});
