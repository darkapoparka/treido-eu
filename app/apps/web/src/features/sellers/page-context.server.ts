import "server-only";
import { createHash } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { readVerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError } from "./errors";
import { parseSellContinuation } from "./sell-entry";
import { parseWorkspaceContinuation } from "./workspace-continuation";

export async function requirePageIdentity(path = "/app") {
  const identity = await readVerifiedIdentity();
  if (!identity) {
    const parsed = parseSellContinuation(path);
    redirect(
      `/sign-in?returnTo=${encodeURIComponent(parsed.ok ? parsed.continuation.target : (parseWorkspaceContinuation(path) ?? "/app"))}`,
    );
  }
  return identity;
}
export function recoveryKey(subject: string, scope: string) {
  return createHash("sha256")
    .update(subject + "/" + scope)
    .digest("hex");
}
export function privatePageFailure(error: unknown): never {
  if (
    error instanceof SellerError &&
    ["FORBIDDEN", "NOT_FOUND", "INVALID_INPUT"].includes(error.code)
  )
    notFound();
  throw new Error("Selling is temporarily unavailable.");
}
export async function readPrivatePage<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    privatePageFailure(error);
  }
}
