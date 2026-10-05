import type { BusinessProfile } from "../sellers/setup-model";

export type PersonalProfileView = {
  sellerId: string;
  revision: number;
  profile: BusinessProfile;
};
export type PersonalProfileCommand = {
  sellerId: string;
  expectedRevision: number;
  requestId: string;
  profile: unknown;
};
