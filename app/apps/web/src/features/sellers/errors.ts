export type SellerErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "CONFLICT"
  | "QUOTA_EXCEEDED"
  | "NOT_AVAILABLE";
export class SellerError extends Error {
  constructor(readonly code: SellerErrorCode) {
    super(code);
    this.name = "SellerError";
  }
}
export type SellerResult<T> =
  { ok: true; data: T } | { ok: false; code: SellerErrorCode };
