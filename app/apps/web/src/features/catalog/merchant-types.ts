export type MerchantReview = Readonly<{
  id: string;
  stars: 1 | 2 | 3 | 4 | 5;
  title: string;
  body: string;
  author: string;
  date: string;
  productTitle: string;
  image?: string;
  reply?: { body: string; author: string; date: string };
  photos?: readonly string[];
}>;
export type MerchantCollectionListing = Readonly<{
  productId: string;
  price?: import("./types").Money;
  compareAt?: import("./types").Money | null;
  rating?: number;
  ratingCount?: string;
  image?: string;
}>;
export type MerchantCollection = Readonly<{
  slug: string;
  title: string;
  image: string;
  profileWide?: boolean;
  productIds?: readonly string[];
  listings?: readonly MerchantCollectionListing[];
  showSaleFilter?: boolean;
  defaultInStockOnly?: boolean;
  /** Captured listing eligibility, never a sellable stock quantity. */
  inStockProductIds?: readonly string[];
  url?: string;
}>;
export type MerchantPresentation = Readonly<{
  /** Source classification is retained for audit, not a visual-parity claim. */
  source?: "captured" | "catalog" | "artwork-derived";
  productIds?: readonly string[];
  followId?: string;
  heroHeight?: number;
  coverHeight?: number;
  storeControlBackground?: string;
  showRecentlyViewed?: boolean;
  wordmarkTop?: number;
  coverVideo?: string;
  descriptionExpandable?: boolean;
  featuredProductIds?: readonly string[];
  featureCollections?: readonly MerchantCollection[];
  locations?: readonly { name: string; address: string }[];
  background: string;
  foreground: string;
  panel?: string;
  wordmark?: string;
  wordmarkWidth?: number;
  wordmarkHeight?: number;
  avatar?: string;
  cover?: string;
  description?: string;
  rating?: number;
  ratingCount?: string;
  reviewCount?: string;
  categories?: readonly MerchantCollection[];
  collections?: readonly MerchantCollection[];
  reviews?: readonly MerchantReview[];
  reviewPhotos?: readonly string[];
  reviewMedia?: readonly MerchantReviewMediaItem[];
  website?: string;
  contacts?: readonly {
    label: string;
    url: string;
    icon: "mail" | "phone" | "instagram" | "external-link";
  }[];
  policies?: readonly { label: string; url: string }[];
}>;
export interface MerchantReviewMediaItem {
  id: string;
  image: string;
  thumbnail: string;
  productImage?: string;
  productTitle?: string;
  title?: string;
  body: string;
  author: string;
  date: string;
  stars?: number;
}
