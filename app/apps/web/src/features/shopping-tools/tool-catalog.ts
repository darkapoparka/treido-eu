import { discoveryDestination } from "../discovery/browse-scope-route";
import { foldDiscoveryText } from "../catalog/public-discovery-model";
import { toolCopy, type ToolLocale } from "./copy";

const catalogue = [
  {
    id: "find-for-me",
    title: "find",
    note: "catalogFind",
    iconPosition: [0, 0],
    hero: "/minis/treido-find-banner.png",
    group: "catalogDiscover",
  },
  {
    id: "deal-finder",
    title: "deal",
    note: "catalogDeal",
    iconPosition: [1, 0],
    group: "catalogDiscover",
  },
  {
    id: "photo-match",
    title: "photo",
    note: "catalogPhoto",
    iconPosition: [2, 0],
    group: "catalogDiscover",
  },
  {
    id: "compare",
    title: "compare",
    note: "catalogCompare",
    iconPosition: [3, 0],
    group: "catalogChoose",
  },
  {
    id: "gift-finder",
    title: "gift",
    note: "catalogGift",
    iconPosition: [0, 1],
    hero: "/minis/treido-gift-banner.png",
    group: "catalogChoose",
  },
  {
    id: "compatibility",
    title: "compatibility",
    note: "catalogCompatibility",
    iconPosition: [1, 1],
    group: "catalogChoose",
  },
  {
    id: "sell-helper",
    title: "sellHelper",
    note: "catalogSellHelper",
    iconPosition: [2, 1],
    group: "catalogSell",
  },
] as const satisfies readonly {
  id: string;
  title: keyof typeof toolCopy.en;
  note: keyof typeof toolCopy.en;
  iconPosition: readonly [number, number];
  hero?: string;
  group: keyof typeof toolCopy.en;
}[];
export type ProductMiniId = (typeof catalogue)[number]["id"];
export type ProductMini = {
  id: ProductMiniId;
  name: string;
  description: string;
  iconPosition: readonly [number, number];
  hero?: string;
  group: string;
};
const ids = new Set<string>(catalogue.map((tool) => tool.id));

export function productMinis(locale: ToolLocale): ProductMini[] {
  const t = toolCopy[locale];
  return catalogue.map((tool) => ({
    id: tool.id,
    name: t[tool.title],
    description: t[tool.note],
    iconPosition: tool.iconPosition,
    ...("hero" in tool ? { hero: tool.hero } : {}),
    group: t[tool.group],
  }));
}

/** Empty native search shows genuine visits; typed search stays within seven tools. */
export function searchProductMinis(
  locale: ToolLocale,
  query: string,
  visits: readonly string[],
): ProductMini[] {
  const tools = productMinis(locale),
    search = foldDiscoveryText(query);
  if (!search)
    return [...new Set(visits)].slice(0, tools.length).flatMap((id) => {
      const tool = tools.find((entry) => entry.id === id);
      return tool ? [tool] : [];
    });
  const rank = (name: string) => {
    const title = foldDiscoveryText(name);
    return title.startsWith(search) ? 0 : title.includes(search) ? 1 : 2;
  };
  return tools
    .filter((tool) =>
      foldDiscoveryText(tool.name + " " + tool.description).includes(search),
    )
    .sort((a, b) => rank(a.name) - rank(b.name));
}

/** Catalogue visits are bounded tab-local presentation, never account/provider state. */
export function readProductMiniVisits(raw: string | null): ProductMiniId[] {
  if (!raw || raw.length > 2048) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return [...new Set(value.slice(0, 64))]
      .filter(
        (id): id is ProductMiniId => typeof id === "string" && ids.has(id),
      )
      .slice(0, catalogue.length);
  } catch {
    return [];
  }
}

/** Keep public criteria; retire the catalogue's separate presentation query. */
export function productMiniHref(
  id: ProductMiniId | "find-for-me/voice",
  locale: ToolLocale,
  source: URLSearchParams,
): string {
  return discoveryDestination(`/minis/${id}?lang=${locale}`, source);
}
