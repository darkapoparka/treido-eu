"use server";
import { getDatabase } from "../../server/db/database";
import { requireVerifiedIdentity } from "../../server/identity/clerk.server";
import { SellerError, type SellerResult } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { readInventory, readPublicInventory } from "./queries.server";
import { changeInventory } from "./commands.server";
import {
  parseInventoryCommand,
  whole,
  type InventoryView,
  type PublicInventory,
} from "./model";
function failure(error: unknown) {
  if (!(error instanceof SellerError))
    console.error("Treido inventory unavailable.");
  return {
    ok: false,
    code: error instanceof SellerError ? error.code : "NOT_AVAILABLE",
  } as const;
}
export async function readInventoryAction(
  input: unknown,
): Promise<SellerResult<InventoryView>> {
  try {
    return {
      ok: true,
      data: await readInventory(
        getDatabase(),
        await requireVerifiedIdentity(),
        input,
      ),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function changeInventoryAction(
  input: unknown,
): Promise<SellerResult<InventoryView>> {
  try {
    const identity = await requireVerifiedIdentity(),
      command = parseInventoryCommand(input),
      database = getDatabase();
    await changeInventory(database, identity, command);
    return {
      ok: true,
      data: await readInventory(database, identity, {
        sellerId: command.sellerId,
        listingId: command.listingId,
      }),
    };
  } catch (error) {
    return failure(error);
  }
}
export async function readPublicInventoryAction(
  listingId: string,
  revision: number,
): Promise<SellerResult<PublicInventory>> {
  try {
    if (!validId(listingId) || !whole(revision, 2, 2147483646))
      throw new SellerError("INVALID_INPUT");
    const inventory = await readPublicInventory(
      getDatabase(),
      listingId,
      revision,
    );
    if (!inventory) throw new SellerError("NOT_FOUND");
    return { ok: true, data: inventory };
  } catch (error) {
    return failure(error);
  }
}
