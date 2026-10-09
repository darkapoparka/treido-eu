import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { SellerError } from "../sellers/errors";
import { normalizeRecipient } from "../team/model";

/** Current provider facts only. This result stays server-side and is never a view model. */
export async function readNotificationRecipient(
  subject: string,
): Promise<string | null> {
  if (!/^user_[A-Za-z0-9_-]{1,120}$/.test(subject))
    throw new SellerError("FORBIDDEN");
  let user;
  try {
    user = await (await clerkClient()).users.getUser(subject);
  } catch {
    throw new SellerError("NOT_AVAILABLE");
  }
  if (user.id !== subject || user.banned || user.locked)
    throw new SellerError("FORBIDDEN");
  const primary = user.emailAddresses.find(
    (address) => address.id === user.primaryEmailAddressId,
  );
  return primary?.verification?.status === "verified"
    ? normalizeRecipient(primary.emailAddress)
    : null;
}
