import "server-only";
import type { SellerTransaction } from "../../server/db/database";
import { SellerError } from "../sellers/errors";

/** Lock both real humans in UUID order before seller/membership locks. Reading
 * by subject does not authenticate the issuer or require them to be online. */
export async function lockInvitationHumans(
  tx: SellerTransaction,
  recipientSubject: string,
  issuerId: string,
) {
  const humans = (
    await tx.client.query<{ id: string; status: string }>(
      `SELECT id,status FROM treido.users WHERE clerk_subject=$1 OR id=$2 ORDER BY id FOR UPDATE`,
      [recipientSubject, issuerId],
    )
  ).rows;
  const issuer = humans.find((row) => row.id === issuerId);
  if (!issuer) throw new SellerError("FORBIDDEN");
  return issuer;
}
