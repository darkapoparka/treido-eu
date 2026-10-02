import { validId } from "./draft-model";
export const MEDIA_LIMITS = {
  count: 12,
  bytes: 12 * 1024 * 1024,
  pixels: 40_000_000,
  uploadSeconds: 300,
  edge: 1600,
} as const;
export type MediaState =
  "staged" | "processing" | "ready" | "failed" | "detached";
export type MediaView = {
  id: string;
  state: MediaState;
  position: number;
  width: number | null;
  height: number | null;
  revision: number;
  error: string | null;
};
export type MediaUploadInput = {
  sellerId: string;
  draftId: string;
  requestId: string;
  bytes: number;
  contentType: string;
  checksum: string;
};
export type MediaUploadIntent = {
  assetId: string;
  url: string;
  headers: Record<string, string>;
  expiresAt: string;
};
export type MediaResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code:
        | "INVALID_INPUT"
        | "FORBIDDEN"
        | "NOT_FOUND"
        | "CONFLICT"
        | "QUOTA_EXCEEDED"
        | "NOT_AVAILABLE";
    };
export function validUpload(input: MediaUploadInput) {
  return (
    !!input &&
    validId(input.sellerId) &&
    validId(input.draftId) &&
    validId(input.requestId) &&
    Number.isSafeInteger(input.bytes) &&
    input.bytes > 0 &&
    input.bytes <= MEDIA_LIMITS.bytes &&
    ["image/jpeg", "image/png", "image/webp"].includes(input.contentType) &&
    /^[a-f0-9]{64}$/.test(input.checksum)
  );
}
