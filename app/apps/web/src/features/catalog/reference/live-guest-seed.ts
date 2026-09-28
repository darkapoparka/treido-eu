import type { AccountSeed } from "../../account/state";
import type { DiscoverySeed } from "../../discovery/state";

// Current installed Shop is being compared as a guest, not as the frozen
// signed-in Alex fixture. The two histories must remain separate.
export const liveGuestAccount: AccountSeed = {
  guest: true,
  profile: { email: "" },
  addresses: [],
  orders: [],
  people: [],
  paymentCards: [],
  hasPaymentProfile: false,
};
export const liveGuestDiscovery: DiscoverySeed = {
  saved: [],
  collections: [],
  viewedProducts: [],
  viewedItems: [],
  visitedMinis: [],
  followed: [],
  cart: [],
  later: [],
};
