import {
  shopSourceAddress,
  shopSourceBuyer,
  shopSourceOrderNumber,
  shopSourcePayment,
} from "./source-fixtures";

// Isolated captured-order fixtures. They never represent a newly completed checkout.
export type CapturedReceipt = {
  displayOrderNumber: string;
  date: string;
  // Net amount: the captured subtotal already includes the discount.
  itemAmount: number;
  // Informational source row; do not subtract it again from the net amount.
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  name: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone: string;
  email: string;
  cardLast4: string;
  shippingMethod: string;
};
const base = {
  displayOrderNumber: shopSourceOrderNumber,
  date: "July 27, 2026",
  name: `${shopSourceBuyer.firstName} ${shopSourceBuyer.lastName}`,
  street: shopSourceAddress.street,
  city: shopSourceAddress.city,
  region: shopSourceAddress.region,
  postalCode: shopSourceAddress.postalCode,
  country: shopSourceAddress.country,
  phone: shopSourceBuyer.phone,
  email: shopSourceBuyer.email,
  cardLast4: shopSourcePayment.last4,
  shippingMethod: "Standard Shipping",
};
export const capturedReceipts: Record<string, CapturedReceipt> = {
  "REF-1001": {
    ...base,
    itemAmount: 365,
    discount: 135,
    shipping: 682,
    tax: 35,
    total: 1082,
  },
  "REF-1002": {
    ...base,
    displayOrderNumber: "12748252",
    itemAmount: 1400,
    discount: 0,
    shipping: 0,
    tax: 0,
    total: 1400,
  },
};
