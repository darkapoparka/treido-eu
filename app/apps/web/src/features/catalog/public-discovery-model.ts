import type { ItemCondition } from "@treido/contracts/categories";
import type { ProductCardData } from "./card-model";
import type { DiscoveryInput } from "./discovery-input";

export type PublicListingCard = ProductCardData & {
  seller: { id: string; name: string; kind: "personal" | "business" };
  categoryId: string;
  condition: ItemCondition;
  locality: string;
  publishedAt: string;
  stockState?: "unknown" | "available" | "reserved" | "out_of_stock";
};
export type PublicSeller = {
  id: string;
  name: string;
  kind: "personal" | "business";
  description: string;
  locality: string;
  country: string;
  services?: import("../seller-settings/model").PublicServiceSettings;
};
export type DiscoveryFacet = { value: string; count: number };
export type PublicDiscoveryPage = {
  input: DiscoveryInput;
  items: PublicListingCard[];
  total: number;
  facets: {
    categories: DiscoveryFacet[];
    conditions: DiscoveryFacet[];
    sellers: DiscoveryFacet[];
  };
  nextCursor: string | null;
  cursorReset: boolean;
  placements?: import("../promotions/placement").PromotionPlacement[];
};

/** Bulgarian transliteration is search normalization, never a display rewrite. */
export const bulgarianSearchLetters: Readonly<Record<string, string>> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sht",
  ъ: "a",
  ь: "y",
  ю: "yu",
  я: "ya",
  ѝ: "i",
};
export function foldDiscoveryText(value: string): string {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replaceAll("ия", "ia")
    .replace(/[а-яѝ]/g, (letter) => bulgarianSearchLetters[letter] ?? letter)
    .replace(/\s+/g, " ")
    .trim();
}
export function discoveryTerms(value: string): string[] {
  return [...new Set(foldDiscoveryText(value).split(" ").filter(Boolean))];
}
