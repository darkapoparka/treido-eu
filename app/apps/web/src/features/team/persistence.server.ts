import "server-only";
import { randomUUID } from "node:crypto";
import {
  inTransaction,
  type SellerDatabase,
  type SellerTransaction,
} from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import {
  authorizeHuman,
  authorizeSeller,
  inputHash,
} from "../sellers/persistence.server";
import { readFreeCatalogueLimits } from "../sellers/free-catalogue.server";
import { SellerError } from "../sellers/errors";
import { enqueueJob } from "../../server/jobs/outbox.server";
import { validId } from "../selling/draft-model";
import {
  TEAM_GRANTS,
  normalizeRecipient,
  parseTeamAccess,
  validTeamCommand,
  type TeamCommand,
  type TeamView,
  type TeamMember,
  type TeamInvitation,
  type IncomingInvitation,
} from "./model";
import {
  assertDelegableTeamAccess,
  canDelegateTeamAccess,
  canManageTeamMember,
  effectiveTeamAccess,
} from "./policy.server";

export type VerifiedRecipientIdentity = VerifiedIdentity & {
  readonly verifiedEmails: readonly string[];
};
type Authority = Awaited<ReturnType<typeof authorizeSeller>>;
type InvitationRow = Omit<
  TeamInvitation,
  "expiresAt" | "delivery" | "canManage"
> & {
  sellerId: string;
  createdBy: string;
  expiresAt: Date;
  acceptedBy: string | null;
  acceptedMembershipRevision: number | null;
  valid: boolean;
};
const invitationColumns = `id,seller_id AS "sellerId",recipient,role,grants,status,created_by AS "createdBy",expires_at AS "expiresAt",accepted_by AS "acceptedBy",accepted_membership_revision AS "acceptedMembershipRevision",expires_at > clock_timestamp() AS valid`;

async function revision(tx: SellerTransaction, sellerId: string) {
  return (
    (
      await tx.client.query<{ revision: number }>(
        `SELECT revision FROM treido.seller_team_state WHERE seller_id=$1`,
        [sellerId],
      )
    ).rows[0]?.revision ?? 0
  );
}
async function advanceRevision(tx: SellerTransaction, sellerId: string) {
  return (
    await tx.client.query<{ revision: number }>(
      `INSERT INTO treido.seller_team_state(seller_id,revision) VALUES($1,1) ON CONFLICT(seller_id) DO UPDATE SET revision=treido.seller_team_state.revision+1 RETURNING revision`,
      [sellerId],
    )
  ).rows[0].revision;
}
async function seatUsage(
  tx: SellerTransaction,
  sellerId: string,
  excludeInvitation: string | null = null,
) {
  return (
    await tx.client.query<{ active: number; reserved: number }>(
      `SELECT
    (SELECT count(*)::int FROM treido.seller_memberships WHERE seller_id=$1 AND status IN ('active','invited')) AS active,
    (SELECT count(*)::int FROM treido.seller_invitations WHERE seller_id=$1 AND status='pending' AND expires_at>clock_timestamp() AND ($2::uuid IS NULL OR id<>$2)) AS reserved`,
      [sellerId, excludeInvitation],
    )
  ).rows[0];
}
async function projectTeam(
  tx: SellerTransaction,
  authorized: Authority,
): Promise<TeamView> {
  const { seller, authority, context, user } = authorized;
  if (seller.kind !== "business") throw new SellerError("FORBIDDEN");
  const limits = await readFreeCatalogueLimits(tx, seller.id, "business");
  const usage = await seatUsage(tx, seller.id);
  const members = (
    await tx.client.query<Omit<TeamMember, "canChange" | "canRevoke" | "self">>(
      `SELECT user_id AS "userId",role,grants,status,revision FROM treido.seller_memberships WHERE seller_id=$1 ORDER BY CASE WHEN status='active' THEN 0 ELSE 1 END,user_id LIMIT 100`,
      [seller.id],
    )
  ).rows;
  const owners = members.filter(
    (m) => m.role === "owner" && m.status === "active",
  ).length;
  const invitations = (
    await tx.client.query<
      InvitationRow & { delivery: TeamInvitation["delivery"] }
    >(
      `SELECT ${invitationColumns},COALESCE((SELECT CASE WHEN d.state='cancelled' THEN 'cancelled' WHEN j.state='dead' THEN 'unavailable' WHEN j.state='cancelled' THEN 'cancelled' ELSE d.state END FROM treido.invitation_deliveries d LEFT JOIN treido.outbox_jobs j ON j.kind='team.invitation' AND j.operation_key=d.id WHERE d.invitation_id=i.id ORDER BY d.created_at DESC,d.id DESC LIMIT 1),'pending') AS delivery FROM treido.seller_invitations i WHERE seller_id=$1 ORDER BY CASE WHEN status='pending' AND expires_at>clock_timestamp() THEN 0 ELSE 1 END,created_at DESC,id DESC LIMIT 50`,
      [seller.id],
    )
  ).rows;
  return {
    sellerId: seller.id,
    name: seller.name,
    revision: await revision(tx, seller.id),
    seats: limits.seats,
    usedSeats: usage.active,
    reservedSeats: usage.reserved,
    managerDefaults: [
      ...effectiveTeamAccess(authority, {
        role: "manager",
        grants: ["seller.read"],
      }),
    ],
    delegable: TEAM_GRANTS.filter((c) => context.capabilities.includes(c)),
    canInviteManager: canDelegateTeamAccess(authority, {
      role: "manager",
      grants: ["seller.read"],
    }),
    members: members.map((m) => ({
      ...m,
      self: m.userId === user.id,
      canChange:
        m.status === "active" &&
        m.role !== "owner" &&
        canManageTeamMember(authority, m),
      canRevoke:
        m.status === "active" &&
        canManageTeamMember(authority, m) &&
        (m.role !== "owner" || owners > 1),
    })),
    invitations: invitations.map((i) => ({
      id: i.id,
      recipient: i.recipient,
      role: i.role,
      grants: i.grants,
      status: i.status === "pending" && !i.valid ? "expired" : i.status,
      expiresAt: i.expiresAt.toISOString(),
      delivery: i.delivery,
      canManage:
        i.status === "pending" &&
        i.valid &&
        canDelegateTeamAccess(authority, { role: i.role, grants: i.grants }),
    })),
  };
}
export function readTeam(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  sellerId: string,
) {
  return inTransaction(database, async (tx) =>
    projectTeam(
      tx,
      await authorizeSeller(tx, identity, sellerId, "team.manage"),
    ),
  );
}
async function queueInvitation(
  tx: SellerTransaction,
  authorized: Authority,
  invitationId: string,
) {
  const deliveryId = randomUUID();
  await tx.client.query(
    `INSERT INTO treido.invitation_deliveries(id,seller_id,invitation_id,actor_id,seller_name) VALUES($1,$2,$3,$4,$5)`,
    [
      deliveryId,
      authorized.seller.id,
      invitationId,
      authorized.user.id,
      authorized.seller.name,
    ],
  );
  await enqueueJob(tx, {
    kind: "team.invitation",
    sellerId: authorized.seller.id,
    resourceId: deliveryId,
    operationKey: deliveryId,
    actorId: authorized.user.id,
    authority: "member",
  });
  return deliveryId;
}
/** The seller lock is also taken by existing inventory/import/inbox authority checks. */
export function changeTeam(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  input: TeamCommand,
): Promise<TeamView> {
  if (!validTeamCommand(input)) throw new SellerError("INVALID_INPUT");
  const access =
    input.kind === "invite" || input.kind === "change"
      ? parseTeamAccess(input.access)!
      : null;
  const recipient =
    input.kind === "invite" ? normalizeRecipient(input.recipient)! : null;
  const hash = inputHash({
    ...input,
    ...(access ? { access } : {}),
    ...(recipient ? { recipient } : {}),
  });
  return inTransaction(database, async (tx) => {
    const authorized = await authorizeSeller(
      tx,
      identity,
      input.sellerId,
      "team.manage",
      true,
    );
    const { seller, user, authority } = authorized;
    if (seller.kind !== "business") throw new SellerError("FORBIDDEN");
    const currentRevision = await revision(tx, seller.id);
    const receipt = (
      await tx.client.query<{ hash: string; revision: number }>(
        `SELECT input_hash AS hash,accepted_revision AS revision FROM treido.team_command_receipts WHERE seller_id=$1 AND actor_id=$2 AND request_id=$3`,
        [seller.id, user.id, input.requestId],
      )
    ).rows[0];
    if (receipt) {
      if (receipt.hash !== hash || receipt.revision !== currentRevision)
        throw new SellerError("CONFLICT");
      return projectTeam(tx, authorized);
    }
    if (currentRevision !== input.expectedRevision)
      throw new SellerError("CONFLICT");
    let resultId: string;
    if (input.kind === "invite") {
      assertDelegableTeamAccess(authority, access!);
      const limits = await readFreeCatalogueLimits(
        tx,
        seller.id,
        "business",
        true,
      );
      const usage = await seatUsage(tx, seller.id);
      if (usage.active + usage.reserved >= limits.seats)
        throw new SellerError("QUOTA_EXCEEDED");
      const duplicate = await tx.client.query(
        `SELECT 1 FROM treido.seller_invitations i WHERE i.seller_id=$1 AND i.recipient=$2 AND ((i.status='pending' AND i.expires_at>clock_timestamp()) OR (i.status='accepted' AND EXISTS(SELECT 1 FROM treido.seller_memberships m WHERE m.seller_id=i.seller_id AND m.user_id=i.accepted_by AND m.status='active'))) LIMIT 1`,
        [seller.id, recipient],
      );
      if (duplicate.rowCount) throw new SellerError("CONFLICT");
      resultId = randomUUID();
      await tx.client.query(
        `INSERT INTO treido.seller_invitations(id,seller_id,recipient,role,grants,language,created_by) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7)`,
        [
          resultId,
          seller.id,
          recipient,
          access!.role,
          JSON.stringify(effectiveTeamAccess(authority, access!)),
          input.language,
          user.id,
        ],
      );
      await queueInvitation(tx, authorized, resultId);
    } else if (input.kind === "cancel" || input.kind === "resend") {
      const invitation = (
        await tx.client.query<InvitationRow>(
          `SELECT ${invitationColumns} FROM treido.seller_invitations WHERE seller_id=$1 AND id=$2 FOR UPDATE`,
          [seller.id, input.invitationId],
        )
      ).rows[0];
      if (!invitation) throw new SellerError("NOT_FOUND");
      assertDelegableTeamAccess(authority, {
        role: invitation.role,
        grants: invitation.grants,
      });
      if (invitation.status !== "pending" || !invitation.valid)
        throw new SellerError("CONFLICT");
      resultId = invitation.id;
      if (input.kind === "cancel") {
        await tx.client.query(
          `UPDATE treido.seller_invitations SET status='cancelled',revision=revision+1 WHERE id=$1`,
          [invitation.id],
        );
        await tx.client.query(
          `UPDATE treido.invitation_deliveries SET state='cancelled' WHERE invitation_id=$1 AND state IN ('pending','unavailable')`,
          [invitation.id],
        );
      } else {
        const recent = (
          await tx.client.query<{ limited: boolean }>(
            `SELECT (count(*) FILTER (WHERE created_at>clock_timestamp()-interval '1 minute')>0 OR count(*) FILTER (WHERE created_at>clock_timestamp()-interval '1 day')>=5) AS limited FROM treido.invitation_deliveries WHERE invitation_id=$1`,
            [invitation.id],
          )
        ).rows[0];
        if (recent.limited) throw new SellerError("CONFLICT");
        // An uncertain delivery may have reached the recipient. A resend is an explicit new intent.
        await queueInvitation(tx, authorized, invitation.id);
      }
    } else {
      const target = (
        await tx.client.query<TeamMember>(
          `SELECT user_id AS "userId",role,grants,status,revision FROM treido.seller_memberships WHERE seller_id=$1 AND user_id=$2 FOR UPDATE`,
          [seller.id, input.userId],
        )
      ).rows[0];
      if (!target) throw new SellerError("NOT_FOUND");
      if (!canManageTeamMember(authority, target))
        throw new SellerError("FORBIDDEN");
      if (target.status !== "active") throw new SellerError("CONFLICT");
      if (input.kind === "change") {
        if (target.role === "owner") throw new SellerError("FORBIDDEN");
        assertDelegableTeamAccess(authority, access!);
        await tx.client.query(
          `UPDATE treido.seller_memberships SET role=$3,grants=$4::jsonb,revision=revision+1 WHERE seller_id=$1 AND user_id=$2`,
          [
            seller.id,
            target.userId,
            access!.role,
            JSON.stringify(access!.grants),
          ],
        );
      } else {
        if (target.role === "owner") {
          const count = (
            await tx.client.query<{ count: number }>(
              `SELECT count(*)::int AS count FROM treido.seller_memberships WHERE seller_id=$1 AND status='active' AND role='owner'`,
              [seller.id],
            )
          ).rows[0].count;
          if (count <= 1) throw new SellerError("CONFLICT");
        }
        await tx.client.query(
          `UPDATE treido.seller_memberships SET status='revoked',revision=revision+1 WHERE seller_id=$1 AND user_id=$2`,
          [seller.id, target.userId],
        );
      }
      // Removed/changed authority cannot leave outstanding delegations that add members later.
      await tx.client.query(
        `UPDATE treido.seller_invitations SET status='cancelled',revision=revision+1 WHERE seller_id=$1 AND created_by=$2 AND status='pending'`,
        [seller.id, target.userId],
      );
      resultId = target.userId;
    }
    const acceptedRevision = await advanceRevision(tx, seller.id);
    await tx.client.query(
      `INSERT INTO treido.team_command_receipts(seller_id,actor_id,request_id,input_hash,result_id,accepted_revision) VALUES($1,$2,$3,$4,$5,$6)`,
      [seller.id, user.id, input.requestId, hash, resultId, acceptedRevision],
    );
    return projectTeam(tx, authorized);
  });
}

function recipientEmails(identity: VerifiedRecipientIdentity) {
  const emails = [
    ...new Set(
      identity.verifiedEmails
        .map(normalizeRecipient)
        .filter((v): v is string => Boolean(v)),
    ),
  ];
  if (!emails.length || emails.length > 50) throw new SellerError("FORBIDDEN");
  return emails;
}
/** No first-user creation, membership write or invitation consumption on this read. */
export function readIncomingInvitations(
  database: SellerDatabase,
  identity: VerifiedRecipientIdentity,
): Promise<IncomingInvitation[]> {
  const emails = recipientEmails(identity);
  return inTransaction(database, async (tx) => {
    let userId: string | null = null;
    try {
      userId = (await authorizeHuman(tx, identity, false)).id;
    } catch (error) {
      if (!(error instanceof SellerError && error.code === "NOT_FOUND"))
        throw error;
    }
    const rows = (
      await tx.client.query<
        InvitationRow & {
          name: string;
          membershipStatus: string | null;
          membershipRole: string | null;
          membershipGrants: string[] | null;
        }
      >(
        `SELECT i.id,i.seller_id AS "sellerId",s.name,i.role,i.grants,i.status,i.expires_at AS "expiresAt",i.expires_at>clock_timestamp() AS valid,m.status AS "membershipStatus",m.role AS "membershipRole",m.grants AS "membershipGrants" FROM treido.seller_invitations i JOIN treido.seller_accounts s ON s.id=i.seller_id AND s.status='active' LEFT JOIN treido.seller_memberships m ON m.seller_id=i.seller_id AND m.user_id=$2 WHERE i.recipient=ANY($1::text[]) AND (i.status<>'accepted' OR i.accepted_by=$2) ORDER BY i.created_at DESC,i.id DESC LIMIT 50`,
        [emails, userId],
      )
    ).rows;
    return rows.map((i) => ({
      id: i.id,
      sellerId: i.sellerId,
      name: i.name,
      role: i.role,
      grants: i.grants,
      expiresAt: i.expiresAt.toISOString(),
      status: i.status === "pending" && !i.valid ? "expired" : i.status,
      canAccept:
        i.status === "pending" && i.valid && i.membershipStatus !== "active",
      canDecline: i.status === "pending" && i.valid,
      canOpen:
        i.status === "accepted" &&
        i.membershipStatus === "active" &&
        (["owner", "manager"].includes(i.membershipRole ?? "") ||
          (i.membershipGrants ?? []).includes("seller.read")),
    }));
  });
}
export function acceptInvitation(
  database: SellerDatabase,
  identity: VerifiedRecipientIdentity,
  invitationId: string,
) {
  if (!validId(invitationId)) throw new SellerError("INVALID_INPUT");
  const emails = recipientEmails(identity);
  return inTransaction(database, async (tx) => {
    const user = await authorizeHuman(tx, identity, true);
    const initial = (
      await tx.client.query<{ sellerId: string }>(
        `SELECT seller_id AS "sellerId" FROM treido.seller_invitations WHERE id=$1 AND recipient=ANY($2::text[])`,
        [invitationId, emails],
      )
    ).rows[0];
    if (!initial) throw new SellerError("FORBIDDEN");
    const seller = (
      await tx.client.query<{ id: string; status: string }>(
        `SELECT id,status FROM treido.seller_accounts WHERE id=$1 AND kind='business' FOR UPDATE`,
        [initial.sellerId],
      )
    ).rows[0];
    if (!seller || seller.status !== "active")
      throw new SellerError("FORBIDDEN");
    const invitation = (
      await tx.client.query<InvitationRow>(
        `SELECT ${invitationColumns} FROM treido.seller_invitations WHERE id=$1 FOR UPDATE`,
        [invitationId],
      )
    ).rows[0];
    const membership = (
      await tx.client.query<TeamMember>(
        `SELECT user_id AS "userId",role,grants,status,revision FROM treido.seller_memberships WHERE seller_id=$1 AND user_id=$2 FOR UPDATE`,
        [seller.id, user.id],
      )
    ).rows[0];
    if (invitation.status === "accepted") {
      if (
        invitation.acceptedBy !== user.id ||
        membership?.status !== "active" ||
        membership.revision !== invitation.acceptedMembershipRevision
      )
        throw new SellerError("FORBIDDEN");
      await authorizeSeller(tx, identity, seller.id, "seller.read");
      return { sellerId: seller.id };
    }
    if (invitation.status !== "pending" || !invitation.valid)
      throw new SellerError("CONFLICT");
    if (membership?.status === "active") throw new SellerError("CONFLICT");
    const limits = await readFreeCatalogueLimits(
      tx,
      seller.id,
      "business",
      true,
    );
    const usage = await seatUsage(tx, seller.id, invitation.id);
    if (usage.active + usage.reserved >= limits.seats)
      throw new SellerError("QUOTA_EXCEEDED");
    const nextRevision = (membership?.revision ?? 0) + 1;
    await tx.client.query(
      `INSERT INTO treido.seller_memberships(seller_id,user_id,role,grants,status,revision) VALUES($1,$2,$3,$4::jsonb,'active',$5) ON CONFLICT(seller_id,user_id) DO UPDATE SET role=EXCLUDED.role,grants=EXCLUDED.grants,status='active',revision=EXCLUDED.revision`,
      [
        seller.id,
        user.id,
        invitation.role,
        JSON.stringify(invitation.grants),
        nextRevision,
      ],
    );
    await tx.client.query(
      `UPDATE treido.seller_invitations SET status='accepted',accepted_by=$2,accepted_membership_revision=$3,accepted_at=clock_timestamp(),revision=revision+1 WHERE id=$1`,
      [invitation.id, user.id, nextRevision],
    );
    await advanceRevision(tx, seller.id);
    return { sellerId: seller.id };
  });
}
