import "server-only";
import { auth } from "@clerk/nextjs/server";
import { requireBackendBindings } from "../config/backend-bindings.server";
import { SellerError } from "../../features/sellers/errors";

export type VerifiedIdentity = Readonly<{ subject: string }>;

export async function readVerifiedIdentity(): Promise<VerifiedIdentity | null> {
  requireBackendBindings();
  const session = await auth({
    acceptsToken: "session_token",
    treatPendingAsSignedOut: true,
  });
  return session.userId && session.sessionId
    ? { subject: session.userId }
    : null;
}

export async function requireVerifiedIdentity(): Promise<VerifiedIdentity> {
  const identity = await readVerifiedIdentity();
  if (!identity) throw new SellerError("UNAUTHENTICATED");
  return identity;
}
