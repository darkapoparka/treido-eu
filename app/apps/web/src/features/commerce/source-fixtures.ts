import type { Address } from "../account/state";

// Values in this file are limited to facts visibly present in the frozen Shop
// reference frames. They are local parity fixtures, not live account/order data.
export const shopSourceBuyer = {
  firstName: "Alex",
  lastName: "Smith",
  email: "alexsmith.mobbin+3@gmail.com",
  phone: "+16502137552",
} as const;

export const shopSourceAddress: Address = {
  id: "shop-source-address",
  firstName: shopSourceBuyer.firstName,
  lastName: shopSourceBuyer.lastName,
  company: "",
  street: "1226 University Dr",
  apartment: "",
  city: "Menlo Park",
  region: "CA",
  postalCode: "94025",
  country: "United States",
  phone: shopSourceBuyer.phone,
  isDefault: true,
};

export const shopSourcePayment = {
  id: "shop-source-card-4263",
  last4: "4263",
  brand: "Visa",
} as const;

export const shopSourceOrderNumber = "12748251";

export const shopSourcePickup = {
  searchPostalCode: "94025",
  warning: "The closest location with your item is more than 100 mi from",
  name: "White Rock Soap Gallery",
  distance: "1,468.9 mi",
  price: "Free",
  street: "10233 East Northwest Highway, Ste 401",
  cityRegion: "Dallas TX",
  readiness: "Usually ready in 24 hours",
} as const;
