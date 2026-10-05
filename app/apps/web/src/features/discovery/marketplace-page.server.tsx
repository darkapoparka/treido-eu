import "server-only";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { getDatabase } from "../../server/db/database";
import { readLocaleRequest } from "../locale/request.server";
import { validId } from "../selling/draft-model";
import { readDiscoveryInput } from "../catalog/discovery-input";
import {
  publicDiscoveryKey,
  readPublicSeller,
} from "../catalog/public-discovery.server";
import { readPromotionDiscovery } from "../promotions/projection.server";
import type {
  PublicDiscoveryPage,
  PublicSeller,
} from "../catalog/public-discovery-model";
import { Marketplace } from "./marketplace";
import { readPublicOrderFeedback } from "../order-feedback/queries.server";
import type { PurchaseFeedbackData } from "./purchase-feedback";
import { purchaseFeedbackPage } from "./purchase-feedback-model";
export type MarketplaceSearchParams = Record<
  string,
  string | string[] | undefined
>;
export async function MarketplacePage({
  raw,
  home = false,
  sellerId,
  info = false,
}: {
  raw: MarketplaceSearchParams;
  home?: boolean;
  sellerId?: string;
  info?: boolean;
}) {
  if (sellerId !== undefined && !validId(sellerId)) notFound();
  const { locale } = await readLocaleRequest();
  const source = {
    ...raw,
    lang: locale,
    ...(home && !raw.sort ? { sort: "newest" } : {}),
    ...(sellerId ? { seller: "all" } : {}),
  };
  const parsed = readDiscoveryInput(source);
  let seller: PublicSeller | null | undefined;
  let page: PublicDiscoveryPage | undefined;
  let purchaseFeedback: PurchaseFeedbackData | undefined;
  try {
    const database = getDatabase();
    if (sellerId) seller = await readPublicSeller(database, sellerId);
    if (info && seller) {
      const feedbackPage = purchaseFeedbackPage(raw.feedbackPage);
      try {
        if (feedbackPage === null)
          throw new RangeError("INVALID_FEEDBACK_PAGE");
        const feedback = await readPublicOrderFeedback(
          database,
          seller.id,
          feedbackPage,
        );
        purchaseFeedback = {
          available: feedback.available,
          items: feedback.feedback,
          more: feedback.more,
          page: feedbackPage,
        };
      } catch {
        console.error("Public order feedback query unavailable.");
        purchaseFeedback = {
          available: false,
          items: [],
          more: false,
          page: feedbackPage ?? 0,
        };
      }
    }
    if (seller !== null && !info)
      page = await readPromotionDiscovery(database, source, {
        key: publicDiscoveryKey(),
        requestId: randomUUID(),
        surface: home ? "home" : "search",
        sellerId,
      });
  } catch {
    console.error("Public marketplace query unavailable.");
    return (
      <Marketplace
        input={parsed.input}
        home={home}
        seller={seller ?? undefined}
        info={false}
        unavailable
      />
    );
  }
  if (sellerId && !seller) notFound();
  return (
    <Marketplace
      key={(sellerId ?? "browse") + ":" + parsed.canonical}
      input={parsed.input}
      page={page}
      home={home}
      seller={seller ?? undefined}
      info={info}
      purchaseFeedback={purchaseFeedback}
    />
  );
}
