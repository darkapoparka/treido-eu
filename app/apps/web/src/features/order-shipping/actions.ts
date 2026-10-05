"use server";
import { reverificationError } from "@clerk/nextjs/server";
import { getDatabase } from "../../server/db/database";
import {
  hasVerifiedRecentAuthentication,
  requireVerifiedIdentity,
} from "../../server/identity/clerk.server";
import { SellerError } from "../sellers/errors";
import { parseCommand } from "./model";
import {
  executeShippingCommand,
  recoverShippingRequest,
  stopUnrecordedShippingRequest,
} from "./commands.server";
export async function shippingCommandAction(raw: unknown) {
  try {
    const command = parseCommand(raw),
      identity = await requireVerifiedIdentity();
    if (
      command.action === "accept" &&
      !hasVerifiedRecentAuthentication(identity)
    )
      return reverificationError("strict");
    return {
      ok: true,
      data: await executeShippingCommand(getDatabase(), identity, command),
    } as const;
  } catch (error) {
    return {
      ok: false,
      code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
    } as const;
  }
}
export async function recoverShippingAction(raw: unknown) {
  try {
    return {
      ok: true,
      data: await recoverShippingRequest(
        getDatabase(),
        await requireVerifiedIdentity(),
        raw,
      ),
    } as const;
  } catch (error) {
    return {
      ok: false,
      code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
    } as const;
  }
}
export async function stopShippingRequestAction(raw: unknown) {
  try {
    return {
      ok: true,
      data: await stopUnrecordedShippingRequest(
        getDatabase(),
        await requireVerifiedIdentity(),
        raw,
      ),
    } as const;
  } catch (error) {
    return {
      ok: false,
      code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
    } as const;
  }
}
