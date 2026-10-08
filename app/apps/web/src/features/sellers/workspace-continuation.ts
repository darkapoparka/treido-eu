import { parseInsightsContinuation } from "../insights/model";
import { parseNotificationContinuation } from "../notifications/navigation-model";
import { validId } from "../selling/draft-model";
import { parseMessagingContinuation } from "../messaging/navigation-model";

/** Additional private entry paths, independently reauthorised by every destination. */
export function parseWorkspaceContinuation(value: unknown): string | null {
  const insights = parseInsightsContinuation(value);
  if (insights) return insights;
  const notification = parseNotificationContinuation(value);
  if (notification) return notification;
  const messaging = parseMessagingContinuation(value);
  if (messaging) return messaging;
  if (
    typeof value !== "string" ||
    value.length > 512 ||
    /[%\\#\s\u0000-\u001f\u007f-\uffff]/.test(value)
  )
    return null;
  const parts = value.split("?");
  if (parts.length > 2) return null;
  const [path, query] = parts;
  const seller =
    /^\/app\/sellers\/([^/]+)(?:\/(onboarding|settings(?:\/(?:store|contact|delivery|payments))?|listings|imports|inventory|team|reservations|moderation|inquiries|billing|promotions))?$/.exec(
      path,
    );
  const inquiry = /^\/app\/sellers\/([^/]+)\/inquiries\/([^/]+)$/.exec(path);
  const operation =
    /^\/ops\/(?:reports|appeals|listings|declarations)\/([^/]+)$/.exec(path);
  const purchaseReview = /^\/checkout\/reviews\/([^/]+)$/.exec(path);
  const payableQuote = /^\/checkout\/payments\/([^/]+)$/.exec(path);
  const paidOrder = /^\/orders\/([^/]+)$/.exec(path);
  const aftercare = /^\/orders\/([^/]+)\/(?:support|feedback)$/.exec(path);
  const sellerAftercare =
    /^\/app\/sellers\/([^/]+)\/orders\/([^/]+)\/support$/.exec(path);
  const operatorAftercare = /^\/ops\/order-aftercare(?:\/([^/]+))?$/.exec(path);
  const sellerOrder = /^\/app\/sellers\/([^/]+)\/orders(?:\/([^/]+))?$/.exec(
    path,
  );
  const paymentRefresh =
    /^\/app\/sellers\/([^/]+)\/settings\/payments\/refresh$/.exec(path);
  const invitation = /^\/app\/invitations\/([^/]+)$/.exec(path);
  const importDetail = /^\/app\/sellers\/([^/]+)\/imports\/([^/]+)$/.exec(path);
  const review = /^\/app\/sellers\/([^/]+)\/listings\/([^/]+)\/review$/.exec(
    path,
  );
  if (
    ![
      "/checkout/reviews",
      "/checkout/payments",
      "/orders",
      "/reservations",
      "/app",
      "/app/products",
      "/app/invitations",
      "/app/intent",
      "/app/onboarding",
      "/ops",
      "/ops/appeals",
      "/ops/declarations",
    ].includes(path) &&
    (!purchaseReview || !validId(purchaseReview[1])) &&
    (!payableQuote || !validId(payableQuote[1])) &&
    (!paidOrder || !validId(paidOrder[1])) &&
    (!aftercare || !validId(aftercare[1])) &&
    (!sellerAftercare ||
      !validId(sellerAftercare[1]) ||
      !validId(sellerAftercare[2])) &&
    (!operatorAftercare ||
      (operatorAftercare[1] !== undefined && !validId(operatorAftercare[1]))) &&
    (!sellerOrder ||
      !validId(sellerOrder[1]) ||
      (sellerOrder[2] !== undefined && !validId(sellerOrder[2]))) &&
    (!paymentRefresh || !validId(paymentRefresh[1])) &&
    (!inquiry || !validId(inquiry[1]) || !validId(inquiry[2])) &&
    (!operation || !validId(operation[1])) &&
    (!invitation || !validId(invitation[1])) &&
    (!seller || !validId(seller[1])) &&
    (!review || !validId(review[1]) || !validId(review[2])) &&
    (!importDetail || !validId(importDetail[1]) || !validId(importDetail[2]))
  )
    return null;
  const params = new URLSearchParams(query);
  const seen = new Set<string>();
  for (const [key, item] of params) {
    if (seen.has(key)) return null;
    seen.add(key);
    if (key === "lang" && ["bg", "en"].includes(item)) continue;
    if (
      key === "step" &&
      seller?.[2] === "onboarding" &&
      ["details", "declaration", "review"].includes(item)
    )
      continue;
    return null;
  }
  const canonical = new URLSearchParams();
  if (params.has("step")) canonical.set("step", params.get("step")!);
  if (params.has("lang")) canonical.set("lang", params.get("lang")!);
  return path + (canonical.size ? `?${canonical}` : "");
}
