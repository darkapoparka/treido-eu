import "server-only";
import { AwsClient } from "aws4fetch";
import { requireBackendBindings } from "../config/backend-bindings.server";
import { validateMediaBindings, type MediaBindings } from "./bindings";
import {
  MEDIA_LIMITS,
  type MediaUploadInput,
} from "../../features/selling/media-model";
import { SellerError } from "../../features/sellers/errors";

export type MediaStorage = {
  prefix: string;
  upload(
    key: string,
    input: Pick<MediaUploadInput, "bytes" | "contentType">,
  ): Promise<{ url: string; headers: Record<string, string> }>;
  head(key: string): Promise<{ bytes: number; etag: string }>;
  freeze(source: string, etag: string, destination: string): Promise<void>;
  read(key: string, maximum: number): Promise<Buffer>;
  put(key: string, bytes: Buffer): Promise<void>;
};
export function createR2Storage(
  binding: MediaBindings,
  credentials: { accessKeyId: string; secretAccessKey: string },
): MediaStorage {
  const client = new AwsClient({
    ...credentials,
    region: "auto",
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
    return `${binding.endpoint}/${binding.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
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
    prefix: binding.prefix,
    async upload(key, input) {
      const signed = await client.sign(
        `${url(key)}?X-Amz-Expires=${MEDIA_LIMITS.uploadSeconds}`,
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
      const bytes = Number(response.headers.get("content-length"));
      const etag = response.headers.get("etag") ?? "";
      if (
        !Number.isSafeInteger(bytes) ||
        bytes < 1 ||
        bytes > MEDIA_LIMITS.bytes ||
        !/^"[a-f0-9]{32}(?:-\d+)?"$/.test(etag)
      )
        throw new SellerError("INVALID_INPUT");
      return { bytes, etag };
    },
    async freeze(source, etag, destination) {
      url(source);
      if (!/^"[a-f0-9]{32}(?:-\d+)?"$/.test(etag))
        throw new SellerError("INVALID_INPUT");
      const response = await request(destination, {
        method: "PUT",
        headers: {
          "x-amz-copy-source": `/${binding.bucket}/${source}`,
          "x-amz-copy-source-if-match": etag,
          // R2 extension: the frozen destination must never be replaced.
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
      const response = await request(key, { method: "GET" });
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
export function requireMediaStorage() {
  requireBackendBindings();
  const configured = validateMediaBindings(process.env);
  if (!configured.ok) throw new SellerError("NOT_AVAILABLE");
  return createR2Storage(configured.bindings, {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  });
}
