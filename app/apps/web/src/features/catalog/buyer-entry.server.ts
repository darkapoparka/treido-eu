import "server-only";
import { randomUUID } from "node:crypto";
import { getDatabase } from "../../server/db/database";
import { readLocaleRequest } from "../locale/request.server";
import { readPromotionDiscovery } from "../promotions/projection.server";
import {
  publicDiscoveryKey,
  readPublicExplore,
} from "./public-discovery.server";
import {
  readDiscoveryInput,
  discoverySearchParams,
  type DiscoveryParams,
} from "./discovery-input";
import { readCatalog } from "./queries.server";
import { readBuyerReferenceMode } from "./buyer-data-mode.server";
import type { BuyerEntryData, BuyerPublicView } from "./buyer-entry-model";

/** Existing eligible public query, with no fixture fallback on failure. */
export async function readBuyerPublicView(
  raw: DiscoveryParams,
  options: { home?: boolean; explore?: boolean; category?: string } = {},
): Promise<BuyerPublicView> {
  const { locale } = await readLocaleRequest();
  const original = readDiscoveryInput(raw);
  const source = discoverySearchParams(original.input, original.cursor);
  const hasSort =
    typeof raw === "string" || raw instanceof URLSearchParams
      ? new URLSearchParams(raw).has("sort")
      : raw.sort !== undefined;
  source.set("lang", locale);
  if (options.home && !hasSort) source.set("sort", "newest");
  if (options.category) source.set("category", options.category);
  const parsed = readDiscoveryInput(source);
  // Explore browses the catalogue without hidden supply filters. The route's
  // full criteria remain in view.input for destination Search/Home links.
  const supply = options.explore
    ? discoverySearchParams(
        readDiscoveryInput({
          category: parsed.input.category ?? undefined,
          lang: parsed.input.locale,
          sort: "newest",
        }).input,
      )
    : source;
  supply.set("lang", parsed.input.locale);
  try {
    const database = getDatabase(),
      key = publicDiscoveryKey();
    const page = options.explore
      ? await readPublicExplore(database, supply, { key })
      : await readPromotionDiscovery(database, supply, {
          key,
          requestId: randomUUID(),
          surface: options.home ? "home" : "search",
        });
    return { input: parsed.input, page };
  } catch {
    console.error("Buyer discovery query unavailable.");
    return { input: parsed.input, unavailable: true };
  }
}

/** Environment selects data only. Routes always render the Shop view owner. */
export async function readBuyerHomeData(
  raw: DiscoveryParams,
): Promise<BuyerEntryData> {
  if (await readBuyerReferenceMode()) return { catalog: await readCatalog() };
  return { publicView: await readBuyerPublicView(raw, { home: true }) };
}

export async function readBuyerExploreData(
  raw: DiscoveryParams,
  category?: string,
): Promise<BuyerEntryData> {
  // Legacy source department names remain guarded local replay. Canonical IDs
  // take the real adapter on both local and hosted, including root/leaf routes.
  if (
    (!category ||
      (!category.startsWith("cat:") && !category.startsWith("nav:"))) &&
    (await readBuyerReferenceMode())
  )
    return { catalog: await readCatalog() };
  return {
    publicView: await readBuyerPublicView(raw, { category, explore: true }),
  };
}
