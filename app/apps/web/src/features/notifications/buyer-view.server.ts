import "server-only";
import { backendConfigured } from "../sellers/backend-status.server";
import { readVerifiedIdentity } from "../../server/identity/clerk.server";
import { getDatabase } from "../../server/db/database";
import { readNotificationFeed } from "./queries.server";
import { parseNotificationQuery, type NotificationFeed } from "./model";
import {
  readDecisionUpdates,
  type DecisionUpdates,
} from "../trust/decision-updates.server";
import { SellerError } from "../sellers/errors";
export type BuyerNotificationView =
  | { state: "guest" | "unavailable" }
  | {
      state: "ready";
      subject: string;
      feed: NotificationFeed;
      decisions: DecisionUpdates;
    };
export async function readBuyerNotifications(raw: {
  filter?: string;
  kind?: string;
  q?: string;
  before?: string;
}): Promise<BuyerNotificationView> {
  const query = parseNotificationQuery({
    sellerId: null,
    filter: raw.filter,
    kind: raw.kind,
    q: raw.q,
    before: raw.before,
  });
  if (!backendConfigured()) return { state: "unavailable" };
  try {
    const identity = await readVerifiedIdentity();
    if (!identity) return { state: "guest" };
    const database = getDatabase();
    const feed = await readNotificationFeed(database, identity, query);
    const decisions = await readDecisionUpdates(database, identity, null);
    return { state: "ready", subject: identity.subject, feed, decisions };
  } catch (error) {
    if (
      error instanceof SellerError &&
      ["FORBIDDEN", "NOT_FOUND", "INVALID_INPUT"].includes(error.code)
    )
      throw error;
    console.error("Buyer notifications unavailable.");
    return { state: "unavailable" };
  }
}
