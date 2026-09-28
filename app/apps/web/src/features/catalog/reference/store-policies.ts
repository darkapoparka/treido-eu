/** Merchant destinations captured in the frozen Kitsch store information. */
export const kitschPolicies = [
  [
    "Refund policy",
    "https://www.mykitsch.com/policies/refund-policy",
    "return-package",
  ],
  [
    "Shipping policy",
    "https://www.mykitsch.com/policies/shipping-policy",
    "package",
  ],
  [
    "Privacy policy",
    "https://www.mykitsch.com/pages/privacy-policy",
    "shield-check",
  ],
  [
    "Terms and conditions",
    "https://www.mykitsch.com/pages/terms-of-service",
    "info",
  ],
] as const;

export function checkoutPolicies(storeId?: string) {
  return storeId === "kitsch"
    ? { terms: kitschPolicies[3][1], privacy: kitschPolicies[2][1] }
    : undefined;
}
