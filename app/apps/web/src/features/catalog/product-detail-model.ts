import type { ProductCardData } from "./card-model";
import type { Money, Product, ProductVariant, Store } from "./types";

export type ProductDetailProduct = Pick<
  Product,
  | "id"
  | "title"
  | "storeId"
  | "color"
  | "images"
  | "price"
  | "compareAt"
  | "rating"
  | "ratingCount"
  | "promotion"
  | "description"
  | "referenceStyle"
  | "referenceImageRatio"
  | "referenceDefaultVariantId"
  | "referenceImageTreatment"
> & {
  readonly variants: readonly ProductVariant[];
  readonly detail?: Product["detail"];
};
export type ProductDetailSeller = Pick<
  Store,
  | "id"
  | "name"
  | "logo"
  | "rating"
  | "ratingCount"
  | "promotionSavings"
  | "referenceWebsite"
> & { readonly policies: Readonly<{ refund: boolean; shipping: boolean }> };
export type ProductDetailView = Readonly<{
  product: ProductDetailProduct;
  seller?: ProductDetailSeller;
  related: readonly ProductCardData[];
}>;

export function projectMoney(value: Money): Money {
  return { amount: value.amount, currency: value.currency };
}
export function projectVariant(
  value: ProductVariant,
  optionNames: readonly string[] = [],
): ProductVariant {
  return {
    id: value.id,
    label: value.label,
    availableQuantity: value.availableQuantity,
    referenceSelectable: value.referenceSelectable,
    referenceQuantityLimit: value.referenceQuantityLimit,
    referenceUnavailable: value.referenceUnavailable,
    referenceColor: value.referenceColor && {
      swatch: value.referenceColor.swatch,
      photo: value.referenceColor.photo,
      unavailable: value.referenceColor.unavailable,
    },
    referenceOptions:
      value.referenceOptions &&
      Object.fromEntries(
        optionNames.flatMap((name) => {
          const option = value.referenceOptions?.[name];
          return option === undefined ? [] : [[name, option]];
        }),
      ),
    referencePrice: value.referencePrice && projectMoney(value.referencePrice),
    referenceCompareAt:
      value.referenceCompareAt && projectMoney(value.referenceCompareAt),
    referenceImage: value.referenceImage,
  };
}
/** Runtime allowlists: adding a source field never silently widens client props. */
export function toProductDetailProduct(value: Product): ProductDetailProduct {
  const detail = value.detail;
  return {
    id: value.id,
    title: value.title,
    storeId: value.storeId,
    color: value.color,
    images: [...value.images],
    price: projectMoney(value.price),
    compareAt: value.compareAt && projectMoney(value.compareAt),
    rating: value.rating,
    ratingCount: value.ratingCount,
    promotion: value.promotion,
    description: value.description,
    referenceStyle: value.referenceStyle,
    referenceImageRatio: value.referenceImageRatio,
    referenceDefaultVariantId: value.referenceDefaultVariantId,
    referenceImageTreatment: value.referenceImageTreatment,
    variants: value.variants.map((variant) =>
      projectVariant(
        variant,
        detail?.optionGroups?.map((group) => group.name),
      ),
    ),
    detail: detail && {
      merchantRatingCount: detail.merchantRatingCount,
      merchantLogoOutline: detail.merchantLogoOutline,
      promotionIcon: detail.promotionIcon,
      reportNotesMerchant: detail.reportNotesMerchant && {
        ratingCount: detail.reportNotesMerchant.ratingCount,
        logoOutline: detail.reportNotesMerchant.logoOutline,
      },
      lowStock: detail.lowStock,
      referenceBadge: detail.referenceBadge,
      referenceBadgeTone: detail.referenceBadgeTone,
      titleNoWrapSuffix: detail.titleNoWrapSuffix,
      referenceBadgeVariantId: detail.referenceBadgeVariantId,
      referenceStockBadge: detail.referenceStockBadge && {
        label: detail.referenceStockBadge.label,
        variantId: detail.referenceStockBadge.variantId,
      },
      highlights: detail.highlights && [...detail.highlights],
      specifications: detail.specifications?.map(({ label, value }) => ({
        label,
        value,
      })),
      descriptionInitiallyCollapsed: detail.descriptionInitiallyCollapsed,
      arrivalLabel: detail.arrivalLabel,
      promotionTerms: detail.promotionTerms,
      markdownLabel: detail.markdownLabel,
      completeDescription: detail.completeDescription,
      descriptionSpecs: detail.descriptionSpecs && [...detail.descriptionSpecs],
      descriptionLink: detail.descriptionLink && {
        label: detail.descriptionLink.label,
        url: detail.descriptionLink.url,
      },
      colorSwatch: detail.colorSwatch,
      colorGallery: detail.colorGallery && [...detail.colorGallery],
      optionGroups: detail.optionGroups?.map(
        ({ name, limit, showSelection, colors }) => ({
          name,
          limit,
          showSelection,
          colors,
        }),
      ),
      delivery: detail.delivery && {
        postalCode: detail.delivery.postalCode,
        message: detail.delivery.message,
        shippingPolicy: detail.delivery.shippingPolicy,
        returns: detail.delivery.returns && {
          message: detail.delivery.returns.message,
          disclaimer: detail.delivery.returns.disclaimer,
        },
      },
      reviewPreview: detail.reviewPreview && {
        cardWidth: detail.reviewPreview.cardWidth,
        distribution: [...detail.reviewPreview.distribution],
        reviews: detail.reviewPreview.reviews.map(
          ({ title, rating, author, date }) => ({
            title,
            rating,
            author,
            date,
          }),
        ),
      },
    },
  };
}
export function toProductDetailSeller(value: Store): ProductDetailSeller {
  return {
    id: value.id,
    name: value.name,
    logo: value.logo,
    rating: value.rating,
    ratingCount: value.ratingCount,
    promotionSavings: value.promotionSavings,
    referenceWebsite: value.referenceWebsite,
    policies: {
      refund: Boolean(value.referencePolicies?.refund),
      shipping: Boolean(value.referencePolicies?.shipping),
    },
  };
}
export function toProductDetailCard(value: ProductCardData): ProductCardData {
  return {
    id: value.id,
    title: value.title,
    images: value.images.slice(0, 1),
    price: projectMoney(value.price),
    compareAt: value.compareAt && projectMoney(value.compareAt),
    rating: value.rating,
    ratingCount: value.ratingCount,
    promotion: value.promotion,
    referenceStyle: value.referenceStyle,
    referenceImageTreatment: value.referenceImageTreatment,
    referenceThumbnails: value.referenceThumbnails && {
      shelf: value.referenceThumbnails.shelf,
      grid: value.referenceThumbnails.grid,
    },
  };
}
export function toProductDetailView(
  product: Product,
  seller: Store | undefined,
  related: readonly Product[],
): ProductDetailView {
  return {
    product: toProductDetailProduct(product),
    seller: seller && toProductDetailSeller(seller),
    related: related.slice(0, 4).map(toProductDetailCard),
  };
}
