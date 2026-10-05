import "server-only";
import { inTransaction, type SellerDatabase } from "../../server/db/database";
import { authorizeHuman } from "../sellers/persistence.server";
import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { normalizeRecipient } from "./model";
import type { VerifiedRecipientIdentity } from "./persistence.server";

/** Declining is recipient-owned, releases the reserved seat and never creates a membership. */
export function declineInvitation(
  database: SellerDatabase,
  identity: VerifiedRecipientIdentity,
  invitationId: string,
): Promise<{ invitationId: string; status: "declined" }> {
  if (!validId(invitationId)) throw new SellerError("INVALID_INPUT");
  const emails = [
    ...new Set(
      identity.verifiedEmails
        .map(normalizeRecipient)
        .filter((email): email is string => email !== null),
    ),
  ];
  if (!emails.length || emails.length > 50) throw new SellerError("FORBIDDEN");
  return inTransaction(database, async (tx) => {
    const user = await authorizeHuman(tx, identity, true);
    const initial = (
      await tx.client.query<{ sellerId: string }>(
        `SELECT seller_id AS "sellerId" FROM treido.seller_invitations WHERE id=$1 AND recipient=ANY($2::text[])`,
        [invitationId, emails],
      )
    ).rows[0];
    if (!initial) throw new SellerError("FORBIDDEN");
    // Same lock order as acceptance, invitation creation and membership revocation.
    await tx.client.query(
      `SELECT id FROM treido.seller_accounts WHERE id=$1 FOR UPDATE`,
      [initial.sellerId],
    );
    const current = (
      await tx.client.query<{
        status: string;
        declinedBy: string | null;
        valid: boolean;
      }>(
        `SELECT status,declined_by AS "declinedBy",expires_at>clock_timestamp() AS valid FROM treido.seller_invitations WHERE id=$1 AND recipient=ANY($2::text[]) FOR UPDATE`,
        [invitationId, emails],
      )
    ).rows[0];
    if (!current) throw new SellerError("FORBIDDEN");
    if (current.status === "declined") {
      if (current.declinedBy !== user.id) throw new SellerError("FORBIDDEN");
      return { invitationId, status: "declined" };
    }
    if (current.status !== "pending" || !current.valid)
      throw new SellerError("CONFLICT");
    await tx.client.query(
      `UPDATE treido.seller_invitations SET status='declined',declined_by=$2,declined_at=clock_timestamp(),revision=revision+1 WHERE id=$1`,
      [invitationId, user.id],
    );
    await tx.client.query(
      `UPDATE treido.invitation_deliveries SET state='cancelled' WHERE invitation_id=$1 AND state IN ('pending','unavailable')`,
      [invitationId],
    );
    await tx.client.query(
      `INSERT INTO treido.seller_team_state(seller_id,revision) VALUES($1,1) ON CONFLICT(seller_id) DO UPDATE SET revision=treido.seller_team_state.revision+1`,
      [initial.sellerId],
    );
    return { invitationId, status: "declined" };
  });
}
