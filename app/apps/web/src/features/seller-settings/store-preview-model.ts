import { SellerError } from "../sellers/errors";
import { validId } from "../selling/draft-model";
import { publicServiceSettings, type PublicServiceSettings } from "./model";

export type SavedStorePreview = {
  sellerId: string;
  name: string;
  description: string;
  locality: string;
  services: PublicServiceSettings;
  publicStoreAvailable: boolean;
};

export type SavedStorePreviewFields = {
  name: unknown;
  description: unknown;
  locality: unknown;
  rawContact: unknown;
  rawDelivery: unknown;
  publicStoreAvailable: unknown;
};

function savedText(value: unknown, min: number, max: number): string {
  if (
    typeof value !== "string" ||
    value.length < min ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
  )
    throw new SellerError("NOT_AVAILABLE");
  return value;
}

/** Projection only; the caller must first authorize the current business. */
export function projectSavedStorePreview(
  sellerId: string,
  fields: SavedStorePreviewFields,
): SavedStorePreview {
  if (!validId(sellerId)) throw new SellerError("INVALID_INPUT");
  if (typeof fields.publicStoreAvailable !== "boolean")
    throw new SellerError("NOT_AVAILABLE");
  return {
    sellerId,
    name: savedText(fields.name, 2, 80),
    description: savedText(fields.description, 0, 1200),
    locality: savedText(fields.locality, 0, 100),
    services: publicServiceSettings(fields.rawContact, fields.rawDelivery),
    publicStoreAvailable: fields.publicStoreAvailable,
  };
}

export function storePreviewPaths(sellerId: string, language: "bg" | "en") {
  if (!validId(sellerId) || !["bg", "en"].includes(language))
    throw new SellerError("INVALID_INPUT");
  const settings = `/app/sellers/${sellerId}/settings/store`;
  return {
    settings: `${settings}?lang=${language}`,
    preview: `${settings}/preview?lang=${language}`,
    publicStore: `/stores/${sellerId}?lang=${language}`,
  };
}
