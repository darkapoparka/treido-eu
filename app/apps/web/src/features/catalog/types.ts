export type Money = Readonly<{
  amount: number;
  currency: "USD" | "EUR" | "GBP";
}>;
export type ProductVariant = Readonly<{
  id: string;
  label: string;
  /** Null means the native snapshot did not establish inventory. */
  availableQuantity: number | null;
  /** Enables local reference selections, never stock or checkout authority. */
  referenceSelectable?: true;
  /** Observed local quantity-control cap, never a live inventory claim. */
  referenceQuantityLimit?: number;
  /** Explicit captured unavailability; unknown stock must not become Sold out. */
  referenceUnavailable?: true;
  /** Native color presentation captured separately from inventory. */
  referenceColor?: Readonly<{
    swatch: string;
    photo: string;
    unavailable?: true;
  }>;
  referenceOptions?: Readonly<Record<string, string>>;
  referencePrice?: Money;
  referenceCompareAt?: Money;
  referenceImage?: string;
}>;
/** A preview quantity is not an inventory promise. Unknown real inventory stays
 * disabled; only an explicitly observed reference control can select a count. */
export function variantSelectionLimit(variant?: ProductVariant): number {
  if (
    !variant ||
    variant.referenceUnavailable ||
    variant.referenceColor?.unavailable
  )
    return 0;
  if (variant.availableQuantity === null) {
    if (!variant.referenceSelectable) return 0;
    const limit = variant.referenceQuantityLimit;
    return limit === undefined
      ? Number.MAX_SAFE_INTEGER
      : Number.isSafeInteger(limit) && limit > 0
        ? limit
        : 0;
  }
  return Number.isSafeInteger(variant.availableQuantity)
    ? Math.max(0, variant.availableQuantity)
    : 0;
}
export type Product = Readonly<{
  id: string;
  title: string;
  storeId: string;
  category: string;
  color?: string;
  gender?: string;
  country?: string;
  shippingDestinations?: readonly string[];
  referenceNewnessRank?: number;
  images: readonly string[];
  price: Money;
  compareAt?: Money;
  rating?: number;
  ratingCount: string;
  promotion?: string;
  detail?: Readonly<{
    /** Merchant rating displayed in this product's captured source history. */
    merchantRatingCount?: string;
    merchantLogoOutline?: boolean;
    promotionIcon?: "plain-bag";
    /** Display-only merchant snapshot behind the captured report notes. */
    reportNotesMerchant?: Readonly<{
      ratingCount: string;
      logoOutline: boolean;
    }>;
    lowStock?: boolean;
    /** Captured display label only; never inventory authority. */
    referenceBadge?: string;
    referenceBadgeTone?: "neutral" | "stock";
    /** Native identifier stays whole when its title wraps. */
    titleNoWrapSuffix?: string;
    referenceBadgeVariantId?: string;
    /** Observed display text, not inventory authority. */
    referenceStockBadge?: Readonly<{ label: string; variantId: string }>;
    highlights?: readonly string[];
    /** Display-only specifications transcribed from the observed native panel. */
    specifications?: readonly Readonly<{ label: string; value: string }>[];
    descriptionInitiallyCollapsed?: boolean;
    arrivalLabel?: string;
    promotionTerms?: string;
    markdownLabel?: string;
    completeDescription?: boolean;
    descriptionSpecs?: readonly string[];
    descriptionLink?: Readonly<{ label: string; url: string }>;
    colorSwatch?: string;
    /** Original gallery order before the selected color photograph is promoted. */
    colorGallery?: readonly string[];
    optionGroups?: readonly Readonly<{
      name: string;
      limit?: number;
      showSelection?: boolean;
      colors?: boolean;
    }>[];
    /** Exact display-only native delivery snapshot; not a shipping quote. */
    delivery?: Readonly<{
      postalCode: string;
      message: string;
      shippingPolicy: boolean;
      returns?: Readonly<{ message: string; disclaimer: string }>;
    }>;
    reviewPreview?: Readonly<{
      cardWidth?: number;
      distribution: readonly number[];
      reviews: readonly Readonly<{
        title: string;
        rating: number;
        author: string;
        date: string;
      }>[];
    }>;
  }>;
  /** Order in the captured new-products shelf; not a release date. */
  sourceNewestRank?: number;
  /** Measured Android reference presentation, never a commerce capability. */
  referenceStyle?: "android";
  referenceImageRatio?: number;
  /** Native entry selection can be unavailable; never choose a different offer silently. */
  referenceDefaultVariantId?: string;
  /** A clean native photograph field already includes the source color treatment. */
  referenceImageTreatment?: "native";
  referenceThumbnails?: Readonly<{ shelf: string; grid: string }>;
  description: string;
  saleUnit: "piece" | "package";
  variants: readonly ProductVariant[];
}>;
/** A saved-list projection can retain a captured item whose commerce facts are
 * incomplete. An absent price is unknown, never a free or purchasable product. */
export type SavedListing = Readonly<{
  referenceStyle?: "android";
  referenceThumbnails?: Readonly<{ shelf: string; grid: string }>;
  compareAt?: Money;
  id: string;
  title: string;
  storeId: string;
  sellerName?: string;
  images: readonly string[];
  price?: Money;
  promotion?: string;
  variantLabel?: string;
  detailUnavailable?: string;
  photoLayout?: "milk" | "pink-partial" | "eye";
}>;
export type ReferencePolicyBlock = Readonly<{
  kind: "paragraph" | "heading" | "list" | "table";
  text?: string;
  items?: readonly string[];
  rows?: readonly (readonly string[])[];
}>;
export type ReferencePolicy = Readonly<{
  title: string;
  blocks: readonly ReferencePolicyBlock[];
}>;
export type Store = Readonly<{
  referenceStyle?: "android";
  id: string;
  name: string;
  logo: string;
  coverImage?: string;
  /** Captured display-only merchant destinations and policy documents. */
  referenceWebsite?: string;
  referencePolicies?: Readonly<
    Partial<Record<"refund" | "shipping", ReferencePolicy>>
  >;
  rating?: number;
  ratingCount: string;
  description: string;
  categories: readonly string[];
  /** A storefront shelf is a projection; its snapshot ratings need not replace
   * the product-detail snapshot, and following must not rewrite the cart. */
  recommendations?: readonly Readonly<{
    productId: string;
    ratingCount?: string;
  }>[];
  /** A source snapshot can expose photo fragments without enough evidence to
   * identify or sell the items. Keep them separate from confirmed products. */
  capturedGrid?: Readonly<{
    productIds: readonly string[];
    unidentifiedPhotos: readonly string[];
  }>;
  promotionSavings?: number;
}>;
export type Catalog = Readonly<{
  /** Ordered merchant shelves in the live Android guest capture. */
  liveHomeStoreIds?: readonly string[];
  liveFollowingPosts?: readonly Readonly<{
    storeId: string;
    productIds: readonly string[];
    added: string;
    wide?: boolean;
  }>[];
  products: readonly Product[];
  stores: readonly Store[];
  savedListings?: readonly SavedListing[];
}>;
// Saved photographs and bounded listings also belong in collection covers.
// Resolve that presentation before falling back to the full product record.
export function resolveSavedListing(
  catalog: Catalog,
  id: string,
): SavedListing | undefined {
  return (
    catalog.savedListings?.find((item) => item.id === id) ??
    catalog.products.find((item) => item.id === id)
  );
}
export function formatMoney(money: Money): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: money.currency,
  }).format(money.amount / 100);
}

/** Local reference projections retain variant identity without rewriting catalog facts. */
export function referenceVariantProduct(
  product: Product,
  variant?: ProductVariant,
): Product {
  const photo = variant?.referenceImage ?? variant?.referenceColor?.photo;
  if (!photo && !variant?.referencePrice) return product;
  return {
    ...product,
    price: variant?.referencePrice ?? product.price,
    compareAt: variant?.referenceCompareAt ?? product.compareAt,
    images: photo
      ? [photo, ...product.images.filter((src) => src !== photo)]
      : product.images,
  };
}
