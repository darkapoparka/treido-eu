"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError, type SellerResult } from "../sellers/errors";
import {
  readTeam,
  changeTeam,
  readIncomingInvitations,
  acceptInvitation,
} from "./persistence.server";
import { requireVerifiedRecipient } from "./recipient.server";
import type { TeamCommand, TeamView, IncomingInvitation } from "./model";

function failure(error: unknown) {
  if (!(error instanceof SellerError))
    console.error("Treido team operation unavailable.");
  return {
    ok: false,
    code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
  } as const;
}
export async function readTeamAction(
  sellerId: string,
): Promise<SellerResult<TeamView>> {
  try {
    return {
      ok: true,
      data: await readTeam(
        getDatabase(),
        await requireVerifiedIdentity(),
        sellerId,
      ),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function changeTeamAction(
  input: TeamCommand,
): Promise<SellerResult<TeamView>> {
  try {
    return {
      ok: true,
      data: await changeTeam(
        getDatabase(),
        await requireVerifiedIdentity(),
        input,
      ),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function readInvitationsAction(): Promise<
  SellerResult<IncomingInvitation[]>
> {
  try {
    return {
      ok: true,
      data: await readIncomingInvitations(
        getDatabase(),
        await requireVerifiedRecipient(),
      ),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function acceptInvitationAction(
  invitationId: string,
): Promise<SellerResult<{ sellerId: string }>> {
  try {
    return {
      ok: true,
      data: await acceptInvitation(
        getDatabase(),
        await requireVerifiedRecipient(),
        invitationId,
      ),
    };
  } catch (error) {
    return failure(error);
  }
}

export async function declineInvitationAction(
  invitationId: string,
): Promise<SellerResult<{ invitationId: string; status: "declined" }>> {
  try {
    const { declineInvitation } = await import("./decisions.server");
    return {
      ok: true,
      data: await declineInvitation(
        getDatabase(),
        await requireVerifiedRecipient(),
        invitationId,
      ),
    };
  } catch (error) {
    return failure(error);
  }
}
