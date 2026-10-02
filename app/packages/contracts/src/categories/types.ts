import type { categoryCatalogue } from "./catalogue";

export type CategoryRootId = (typeof categoryCatalogue)[number]["id"];
export type CategoryLeafId =
  (typeof categoryCatalogue)[number]["leaves"][number]["id"];
export type CategoryId = CategoryRootId | CategoryLeafId;
export type CategoryLabels = Readonly<{ bg: string; en: string }>;
export type SellerKind = "personal" | "business";
export type ItemCondition =
  | "new"
  | "new_other"
  | "like_new"
  | "good"
  | "fair"
  | "for_parts"
  | "refurbished";

type AttributeBase = Readonly<{
  id: string;
  labels: CategoryLabels;
  required: boolean;
}>;
export type AttributeDefinition = AttributeBase &
  (
    | Readonly<{ type: "text"; maxLength: number; format?: "date" }>
    | Readonly<{ type: "enum"; values: readonly string[] }>
    | Readonly<{
        type: "multi_enum";
        values: readonly string[];
        maxItems: number;
      }>
    | Readonly<{ type: "integer"; min: number; max: number; unit?: string }>
    | Readonly<{
        type: "decimal";
        precision: number;
        minMinor: number;
        maxMinor: number;
        unit: string;
      }>
    | Readonly<{ type: "boolean"; mustBeTrue?: true }>
    | Readonly<{
        type: "dimension";
        units: readonly ["mm", "cm", "m"];
        maxMillimetres: number;
      }>
  );

export type AttributeProfile = Readonly<{
  id: string;
  version: 1;
  fields: readonly AttributeDefinition[];
}>;
export type CategoryPolicy = Readonly<{
  version: 1;
  reviewStatus: "pending";
  enabledForPublish: false;
  sellerKinds: readonly SellerKind[];
  conditions: readonly ItemCondition[];
  countries: readonly ["BG"];
  handoverModes: readonly ("shipping" | "pickup")[];
  purchaseModes: readonly ("contact" | "checkout")[];
  restrictions: readonly string[];
}>;
export type CategoryRoot = Readonly<{
  id: CategoryRootId;
  kind: "root";
  parentId: null;
  slug: string;
  labels: CategoryLabels;
}>;
export type CategoryLeaf = Readonly<{
  id: CategoryLeafId;
  kind: "leaf";
  parentId: CategoryRootId;
  slug: string;
  labels: CategoryLabels;
  profile: AttributeProfile;
  policy: CategoryPolicy;
}>;
export type Category = CategoryRoot | CategoryLeaf;
