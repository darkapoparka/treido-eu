import "server-only";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { getDatabase } from "../../server/db/database";
import { readLocaleRequest } from "../locale/request.server";
import { validId } from "../selling/draft-model";
import {
  readDiscoveryInput,
  discoverySearchParams,
  type DiscoveryParams,
} from "../catalog/discovery-input";
import {
  publicDiscoveryKey,
  readPublicSeller,
} from "../catalog/public-discovery.server";
import { readPromotionDiscovery } from "../promotions/projection.server";
import { readPublicOrderFeedback } from "../order-feedback/queries.server";
import { purchaseFeedbackPage } from "./purchase-feedback-model";
import type { PublicStoreView } from "./public-store-model";

/** Public seller eligibility, publication and feedback owners remain the sole
 * read authorities. A missing seller is 404; a failed read never becomes empty. */
export async function readPublicStoreView(
  id: string,
  raw: DiscoveryParams,
  info = false,
): Promise<PublicStoreView> {
  if (!validId(id)) notFound();
  const { locale } = await readLocaleRequest();
  const original = readDiscoveryInput(raw);
  const source = discoverySearchParams(
    { ...original.input, locale, seller: "all" },
    original.cursor,
  );
  const input = readDiscoveryInput(source).input;
  const view: PublicStoreView = { input };
  let database: ReturnType<typeof getDatabase>;
  try {
    database = getDatabase();
    const seller = await readPublicSeller(database, id);
    if (seller) view.seller = seller;
  } catch {
    console.error("Public seller query unavailable.");
    return { input, unavailable: true };
  }
  if (!view.seller) notFound();
  try {
    view.page = await readPromotionDiscovery(database, source, {
      key: publicDiscoveryKey(),
      requestId: randomUUID(),
      surface: "search",
      sellerId: id,
    });
  } catch {
    console.error("Public seller listings query unavailable.");
    view.unavailable = true;
  }
  if (info) {
    const feedbackPage = purchaseFeedbackPage(
      typeof raw === "string" || raw instanceof URLSearchParams
        ? (new URLSearchParams(raw).get("feedbackPage") ?? undefined)
        : raw.feedbackPage,
    );
    try {
      if (feedbackPage === null) throw new RangeError("INVALID_FEEDBACK_PAGE");
      const feedback = await readPublicOrderFeedback(
        database,
        id,
        feedbackPage,
      );
      view.purchaseFeedback = {
        available: feedback.available,
        items: feedback.feedback,
        more: feedback.more,
        page: feedbackPage,
      };
    } catch {
      console.error("Public order feedback query unavailable.");
      view.purchaseFeedback = {
        available: false,
        items: [],
        more: false,
        page: feedbackPage ?? 0,
      };
    }
  }
  return view;
}
