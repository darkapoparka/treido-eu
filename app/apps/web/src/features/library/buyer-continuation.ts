import { parseShoppingToolContinuation } from "../shopping-tools/intent";
import { parseSearchContinuation } from "../saved-searches/model";
import { privacyContinuation } from "../account-privacy/model";
import { parseAssistantContinuation } from "../assistant-tools/continuation";
import { parseGiftContinuation } from "../gift-finder/continuation";
import { parseAssistantInputContinuation } from "../photo-match/continuation";
import { parseShippingContinuation } from "../order-shipping/integration";
/** Buyer sign-in returns only to known local browsing/library routes. It never executes a save. */
export function parseBuyerContinuation(value: unknown): string | null {
  const shipping = parseShippingContinuation(value);
  if (shipping) return shipping;
  const assistantInput = parseAssistantInputContinuation(value);
  if (assistantInput) return assistantInput;
  if (
    typeof value === "string" &&
    !/[\u0000-\u0020\u007f]/.test(value) &&
    /^\/account\/(?:notifications|privacy\/(?:promotions|closure|preferences|security))(?:\?lang=(?:bg|en))?$/.test(
      value,
    )
  )
    return value;
  const gift = parseGiftContinuation(value);
  if (gift) return gift;
  const privacy = privacyContinuation(value);
  if (privacy) return privacy;
  const assistant = parseAssistantContinuation(value);
  if (assistant) return assistant;
  const savedSearch = parseSearchContinuation(value);
  if (savedSearch) return savedSearch;
  const shoppingTool = parseShoppingToolContinuation(value);
  if (shoppingTool) return shoppingTool;
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  )
    return null;
  try {
    const url = new URL(value, "https://treido.invalid");
    if (
      url.origin !== "https://treido.invalid" ||
      url.hash ||
      url.username ||
      url.password
    )
      return null;
    if (
      !/^\/(?:search|saved|following|cart)?$/.test(url.pathname) &&
      !/^\/(?:products\/[a-f0-9-]{36}|stores\/[a-f0-9-]{36}(?:\/(?:info|search))?)$/.test(
        url.pathname,
      )
    )
      return null;
    return url.pathname + url.search;
  } catch {
    return null;
  }
}
