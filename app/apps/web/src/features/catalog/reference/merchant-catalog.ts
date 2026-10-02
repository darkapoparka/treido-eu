import type { Catalog, Store, Product } from "../types";
import type {
  MerchantPresentation,
  MerchantCollection,
} from "../merchant-types";
import { merchantPresentations } from "./live-merchant-fixtures";
import { capturedMerchantProfiles } from "./merchant-profiles-data";
import { merchantArtworkThemes } from "./merchant-artwork-themes";
import { merchantKey, merchantProducts } from "./merchant-catalog-model";
export { merchantKey, merchantProducts } from "./merchant-catalog-model";
function catalogCategories(products: readonly Product[]): MerchantCollection[] {
  if (!products.length) return [];
  const image = (p: Product) => p.referenceThumbnails?.grid ?? p.images[0];
  const all: MerchantCollection = {
    slug: "shop-all",
    title: "Shop all",
    image: image(products[0]),
    productIds: products.map((p) => p.id),
    profileWide: true,
  };
  const groups = new Map<string, Product[]>();
  for (const p of products)
    if (p.category && p.category !== "Shop all")
      groups.set(p.category, [...(groups.get(p.category) ?? []), p]);
  if (groups.size < 2) return [all];
  return [
    all,
    ...Array.from(groups, ([title, items]) => ({
      title,
      slug: `catalog-${title
        .normalize("NFKD")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")}`,
      image: image(items[0]),
      productIds: items.map((p) => p.id),
    })),
  ];
}
/** No name allowlist: every seller in the live catalog receives the same UI contract. */
export function projectMerchantCatalog(catalog: Catalog): Catalog {
  if (!catalog.liveHomeStoreIds) return catalog;
  const groups = new Map<string, Store[]>();
  for (const store of catalog.stores)
    groups.set(merchantKey(store), [
      ...(groups.get(merchantKey(store)) ?? []),
      store,
    ]);
  const sources = new Map(
    Object.entries(merchantPresentations).map(([name, value]) => [
      merchantKey({ name, id: name }),
      value,
    ]),
  );
  return {
    ...catalog,
    stores: catalog.stores.map((store) => {
      const key = merchantKey(store),
        siblings = groups.get(key)!;
      const items = merchantProducts(store, catalog);
      const curated = sources.get(key);
      const captured =
        curated ??
        (Object.hasOwn(capturedMerchantProfiles, key)
          ? capturedMerchantProfiles[key]
          : undefined);
      const artwork = Object.hasOwn(merchantArtworkThemes, key)
        ? merchantArtworkThemes[key]
        : undefined;
      const logo = captured?.avatar ?? siblings.find((s) => s.logo)?.logo;
      const description =
        captured?.description ||
        siblings.find((s) => s.description)?.description ||
        "";
      const website =
        captured?.website ??
        siblings.find((s) => s.referenceWebsite)?.referenceWebsite;
      const ratingStore =
        store.rating === undefined
          ? siblings.find((s) => s.rating !== undefined)
          : store;
      const categories = captured?.categories ?? catalogCategories(items);
      const presentation: MerchantPresentation = Object.assign(
        {
          source: captured
            ? "captured"
            : artwork
              ? "artwork-derived"
              : "catalog",
          background: artwork?.background ?? "#e8e6e1",
          foreground: artwork?.foreground ?? "#171717",
          panel: artwork?.panel ?? "#ffffff40",
          avatar: logo,
          description,
          website,
          rating: ratingStore?.rating,
          ratingCount: ratingStore?.ratingCount,
          cover: siblings.find((s) => s.coverImage)?.coverImage,
          heroHeight: curated ? curated.heroHeight : 260,
          categories,
          featuredProductIds: curated
            ? curated.featuredProductIds
            : items.slice(0, 4).map((p) => p.id),
        } satisfies MerchantPresentation,
        captured ?? {},
        {
          productIds: items.map((p) => p.id),
          followId: siblings[0].id,
        },
      );
      return {
        ...store,
        referenceStyle: "android" as const,
        logo: logo || store.logo,
        description,
        referenceWebsite: website,
        referenceMerchant: presentation,
      };
    }),
  };
}
