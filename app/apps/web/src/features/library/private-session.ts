import type { SellerResult } from "../sellers/errors";

/** The server-derived subject binds a private projection; it grants no authority. */
export type PrivateResult<T> = SellerResult<T> & { subject: string | null };
export type PrivateScope = {
  key: string;
  identityKey: string;
  subject: string | null;
  isCurrent: () => boolean;
};
export function acceptsPrivateResult(
  scope: PrivateScope,
  response: PrivateResult<unknown>,
): boolean {
  return scope.isCurrent() && response.subject === scope.subject;
}
