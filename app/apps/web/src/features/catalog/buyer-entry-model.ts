import type { DiscoveryInput } from "./discovery-input";
import type { PublicDiscoveryPage } from "./public-discovery-model";
import type { Catalog } from "./types";

/** Fixture catalogue is development data, never a fabricated public DTO. */
export type BuyerPublicView = {
  input: DiscoveryInput;
  page?: PublicDiscoveryPage;
  unavailable?: boolean;
};
export type BuyerEntryData =
  | { catalog: Catalog; publicView?: never }
  | { publicView: BuyerPublicView; catalog?: never };
