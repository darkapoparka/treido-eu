import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import {
  requireVerifiedIdentity,
  type VerifiedIdentity,
} from "../../server/identity/clerk.server";
import { SellerError } from "../sellers/errors";
import { normalizeRecipient } from "./model";
import type { VerifiedRecipientIdentity } from "./persistence.server";

/** Provider-side verified email facts are never accepted as action parameters. */
export async function readVerifiedRecipient(
  identity: VerifiedIdentity,
): Promise<VerifiedRecipientIdentity> {
  const user = await (await clerkClient()).users.getUser(identity.subject);
  if (user.id !== identity.subject || user.banned || user.locked)
    throw new SellerError("FORBIDDEN");
  const verifiedEmails = user.emailAddresses
    .filter((address) => address.verification?.status === "verified")
    .map((address) => normalizeRecipient(address.emailAddress))
    .filter((value): value is string => value !== null);
  return { ...identity, verifiedEmails };
}
export async function requireVerifiedRecipient() {
  return readVerifiedRecipient(await requireVerifiedIdentity());
}
