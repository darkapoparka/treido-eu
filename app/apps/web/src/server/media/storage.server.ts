import "server-only";
import { createHash } from "node:crypto";
import { AwsClient } from "aws4fetch";
import { requireBackendBindings } from "../config/backend-bindings.server";
import { validateMediaBindings, type MediaBindings } from "./bindings";
import { MEDIA_LIMITS } from "../../features/selling/media-model";
import { SellerError } from "../../features/sellers/errors";

export type MediaStorage = {
  scope: string;
  prefix: string;
  remove(key: string): Promise<void>;
  upload(
    key: string,
    input: { bytes: number; contentType: string },
  ): Promise<{ url: string; headers: Record<string, string> }>;
  head(key: string): Promise<{ bytes: number; etag: string }>;
  freeze(
    source: string,
    etag: string,
    destination: string,
    checksum?: string,
  ): Promise<void>;
  read(key: string, maximum: number): Promise<Buffer>;
  put(key: string, bytes: Buffer): Promise<void>;
};
async function boundedBody(
  response: Response,
  maximum: number,
): Promise<Buffer> {
  const length = Number(response.headers.get("content-length"));
  if (!Number.isSafeInteger(length) || length < 1 || length > maximum) {
    await response.body?.cancel();
    throw new SellerError("INVALID_INPUT");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new SellerError("NOT_AVAILABLE");
  let total = 0;
  const parts: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximum) {
        await reader.cancel();
        throw new SellerError("INVALID_INPUT");
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (total !== length) throw new SellerError("INVALID_INPUT");
  return Buffer.concat(parts);
}
export function createS3Storage(
  binding: MediaBindings,
  credentials: { accessKeyId: string; secretAccessKey: string },
): MediaStorage {
  const client = new AwsClient({
    ...credentials,
    region: binding.region ?? "auto",
    service: "s3",
    retries: 1,
  });
  const url = (key: string) => {
    if (
      !key.startsWith(binding.prefix) ||
      key.length > 300 ||
      !/^[a-zA-Z0-9/_-]+(?:\.webp)?$/.test(key)
    )
      throw new SellerError("INVALID_INPUT");
    return (
      binding.endpoint +
      "/" +
      binding.bucket +
      "/" +
      key.split("/").map(encodeURIComponent).join("/")
    );
  };
  async function request(key: string, init: RequestInit) {
    const signed = await client.sign(url(key), init);
    const response = await fetch(signed, {
      signal: AbortSignal.timeout(15000),
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new SellerError("NOT_AVAILABLE");
    }
    return response;
  }
  return {
    scope: createHash("sha256")
      .update(
        JSON.stringify([
          binding.provider ?? "r2",
          binding.endpoint,
          binding.bucket,
          binding.prefix,
          binding.purpose,
        ]),
      )
      .digest("hex"),
    prefix: binding.prefix,
    async remove(key) {
      const response = await request(key, { method: "DELETE" });
      await response.body?.cancel();
      // Supported unversioned S3 deletion, not a lifecycle promise or a versioned delete marker.
      if (
        response.status !== 204 ||
        response.headers.get("x-amz-delete-marker") === "true" ||
        (response.headers.get("x-amz-version-id") &&
          response.headers.get("x-amz-version-id") !== "null")
      )
        throw new SellerError("NOT_AVAILABLE");
    },
    async upload(key, input) {
      const signed = await client.sign(
        url(key) + "?X-Amz-Expires=" + MEDIA_LIMITS.uploadSeconds,
        {
          method: "PUT",
          headers: {
            "content-type": input.contentType,
            "content-length": String(input.bytes),
          },
          aws: { signQuery: true, allHeaders: true },
        },
      );
      return {
        url: signed.url,
        headers: { "content-type": input.contentType },
      };
    },
    async head(key) {
      const response = await request(key, { method: "HEAD" });
      const bytes = Number(response.headers.get("content-length")),
        etag = response.headers.get("etag") ?? "";
      if (
        !Number.isSafeInteger(bytes) ||
        bytes < 1 ||
        bytes > MEDIA_LIMITS.bytes ||
        !/^"[a-f0-9]{32}(?:-\d+)?"$/.test(etag)
      )
        throw new SellerError("INVALID_INPUT");
      return { bytes, etag };
    },
    async freeze(source, etag, destination, checksum) {
      url(source);
      if (!/^"[a-f0-9]{32}(?:-\d+)?"$/.test(etag))
        throw new SellerError("INVALID_INPUT");
      if (binding.provider === "neon") {
        // This unique server-only destination is allocated per completion attempt.
        // Do not rely on R2 copy extensions, S3 versioning or unenforced lifecycle rules.
        if (
          !checksum ||
          !/^[a-f0-9]{64}$/.test(checksum) ||
          source === destination ||
          !destination.startsWith(binding.prefix + "immutable/")
        )
          throw new SellerError("INVALID_INPUT");
        const response = await request(source, {
          method: "GET",
          headers: { "if-match": etag },
        });
        if (response.headers.get("etag") !== etag) {
          await response.body?.cancel();
          throw new SellerError("CONFLICT");
        }
        const bytes = await boundedBody(response, MEDIA_LIMITS.bytes);
        if (createHash("sha256").update(bytes).digest("hex") !== checksum)
          throw new SellerError("INVALID_INPUT");
        const written = await request(destination, {
          method: "PUT",
          headers: {
            "content-type": "application/octet-stream",
            "content-length": String(bytes.byteLength),
          },
          body: new Uint8Array(bytes),
        });
        await written.body?.cancel();
        return;
      }
      const response = await request(destination, {
        method: "PUT",
        headers: {
          "x-amz-copy-source": "/" + binding.bucket + "/" + source,
          "x-amz-copy-source-if-match": etag,
          "cf-copy-destination-if-none-match": "*",
        },
      });
      const result = await response.text();
      if (
        result.length > 8192 ||
        !result.includes("CopyObjectResult") ||
        result.includes("<Error>")
      )
        throw new SellerError("NOT_AVAILABLE");
    },
    async read(key, maximum) {
      return boundedBody(await request(key, { method: "GET" }), maximum);
    },
    async put(key, bytes) {
      const response = await request(key, {
        method: "PUT",
        headers: {
          "content-type": "image/webp",
          "content-length": String(bytes.byteLength),
        },
        body: new Uint8Array(bytes),
      });
      await response.body?.cancel();
    },
  };
}
/** Compatibility for the existing R2 consumer and its tests. */
export const createR2Storage = createS3Storage;
export function requireMediaStorage() {
  requireBackendBindings();
  const configured = validateMediaBindings(process.env);
  if (!configured.ok) throw new SellerError("NOT_AVAILABLE");
  const neon = configured.bindings.provider === "neon";
  return createS3Storage(configured.bindings, {
    accessKeyId: (neon
      ? process.env.AWS_ACCESS_KEY_ID
      : process.env.R2_ACCESS_KEY_ID)!,
    secretAccessKey: (neon
      ? process.env.AWS_SECRET_ACCESS_KEY
      : process.env.R2_SECRET_ACCESS_KEY)!,
  });
}
