import "server-only";
import { auth } from "@clerk/nextjs/server";
import { requireBackendBindings } from "../config/backend-bindings.server";
import { SellerError } from "../../features/sellers/errors";

export type VerifiedIdentity = Readonly<{ subject: string }>;

// Request-local evidence is attached only by Clerk's verified server session.
// A deserialized identity or synthetic job identity cannot assert recent auth.
const recentAuthentication = new WeakMap<VerifiedIdentity, () => boolean>();

export function hasVerifiedRecentAuthentication(identity: VerifiedIdentity) {
  return recentAuthentication.get(identity)?.() === true;
}

export async function readVerifiedIdentity(): Promise<VerifiedIdentity | null> {
  requireBackendBindings();
  const session = await auth({
    acceptsToken: "session_token",
    treatPendingAsSignedOut: true,
  });
  if (!session.userId || !session.sessionId) return null;
  const identity = Object.freeze({ subject: session.userId });
  const checkedAt = Date.now();
  recentAuthentication.set(
    identity,
    () =>
      Date.now() - checkedAt < 30_000 &&
      session.has({ reverification: "strict" }),
  );
  return identity;
}

export async function requireVerifiedIdentity(): Promise<VerifiedIdentity> {
  const identity = await readVerifiedIdentity();
  if (!identity) throw new SellerError("UNAUTHENTICATED");
  return identity;
}
