export type PaymentLanguage = "bg" | "en";
const en = {
  payments: "Payments",
  orders: "Paid orders",
  checkout: "Payment review",
  cart: "Cart",
  empty: "No paid orders yet.",
  unavailable: "Payments are not available for this seller yet.",
  policyUnavailable:
    "Payment terms are awaiting approval. You can still contact the seller.",
  review: "Review and reserve for payment",
  pay: "Continue to secure payment",
  confirm: "Pay",
  cancel: "Cancel unpaid payment",
  refresh: "Check status",
  back: "Back to payment settings",
  deadline: "Original reservation deadline",
  total: "Total",
  pickup: "Collection in person",
  tax: "Prices include applicable tax. No buyer fee or delivery charge.",
  terms: "Approved sale terms",
  onboarding: "Continue Stripe onboarding",
  requirements: "Information Stripe currently requires",
  ready: "Ready to accept payments",
  notReady: "Onboarding or account review required",
  noRedirect:
    "Readiness is checked with Stripe. Returning from onboarding does not complete verification.",
  reconciling:
    "Payment status is being checked. Please keep this payment; no new charge will be created.",
  expired:
    "The reservation deadline has passed. Payment availability is being checked.",
  failed:
    "This action could not be completed. Retry the same request or check status.",
  denied: "This account no longer has access to this action.",
  conflict:
    "The order or reservation changed. Check its current status before continuing.",
  checking: "Checking account access…",
  succeeded: "Check your order’s current payment and collection status.",
  readyAction: "Mark ready for collection",
  collectedAction: "Confirm I collected the items",
  refundAction: "Request full refund",
  reason: "Refund reason",
  confirmRefund:
    "I confirm a full refund of this order, including the platform fee and transfer reversal.",
  refundNotice:
    "Refunds are verified with Stripe. A pending or uncertain refund blocks collection. Refunds do not automatically restock items.",
  status: "Status",
  retryOriginal: "Retry the saved request",
  payment: "Payment",
  fulfilment: "Collection",
  settlement: "Seller transfer",
  settlementNotice:
    "A verified Stripe transfer is separate from a payout to the seller’s bank.",
  statuses: {
    prepared: "Prepared",
    creating: "Starting payment",
    reconciling: "Checking payment",
    requires_payment_method: "Payment method needed",
    requires_action: "Authentication needed",
    processing: "Processing",
    paid: "Paid",
    cancelling: "Checking cancellation",
    cancelled: "Cancelled",
    quarantined: "Needs reconciliation",
    refund_pending: "Refund pending",
    refunded: "Refunded",
    disputed: "Disputed",
    reconciliation: "Needs reconciliation",
    pending: "Pending",
    ready: "Ready for collection",
    collected: "Collected",
    blocked: "Collection blocked",
    transferred: "Transfer verified",
    reversed: "Transfer reversed",
  },
};
const bg: typeof en = {
  payments: "Плащания",
  orders: "Платени поръчки",
  checkout: "Преглед на плащането",
  cart: "Количка",
  empty: "Все още няма платени поръчки.",
  unavailable: "Плащанията все още не са достъпни за този продавач.",
  policyUnavailable:
    "Условията за плащане очакват одобрение. Можете да се свържете с продавача.",
  review: "Преглед и резервация за плащане",
  pay: "Продължи към защитено плащане",
  confirm: "Плати",
  cancel: "Откажи неплатеното плащане",
  refresh: "Провери статуса",
  back: "Назад към настройките за плащания",
  deadline: "Първоначален срок на резервацията",
  total: "Общо",
  pickup: "Лично получаване",
  tax: "Цените включват приложимите данъци. Няма такса за купувача или доставка.",
  terms: "Одобрени условия на продажбата",
  onboarding: "Продължи регистрацията в Stripe",
  requirements: "Информация, която Stripe изисква в момента",
  ready: "Готов за приемане на плащания",
  notReady: "Необходима е регистрация или проверка на профила",
  noRedirect:
    "Готовността се проверява в Stripe. Връщането от регистрацията не завършва проверката.",
  reconciling:
    "Статусът на плащането се проверява. Запазете това плащане; няма да се създаде ново таксуване.",
  expired:
    "Срокът на резервацията е изтекъл. Проверява се възможността за плащане.",
  failed:
    "Действието не беше завършено. Повторете същата заявка или проверете статуса.",
  denied: "Този профил вече няма достъп до действието.",
  conflict:
    "Поръчката или резервацията е променена. Проверете текущия статус, преди да продължите.",
  checking: "Проверка на достъпа…",
  succeeded:
    "Проверете текущия статус на плащането и получаването в поръчката.",
  readyAction: "Готова за получаване",
  collectedAction: "Потвърждавам, че получих артикулите",
  refundAction: "Заяви пълно възстановяване",
  reason: "Причина за възстановяването",
  confirmRefund:
    "Потвърждавам пълно възстановяване на тази поръчка, включително таксата на платформата и обръщане на превода.",
  refundNotice:
    "Възстановяванията се проверяват в Stripe. Чакащ или неясен резултат блокира получаването. Артикулите не се връщат автоматично в наличността.",
  status: "Статус",
  retryOriginal: "Повтори запазената заявка",
  payment: "Плащане",
  fulfilment: "Получаване",
  settlement: "Превод към продавача",
  settlementNotice:
    "Потвърден превод в Stripe е отделен от изплащане към банковата сметка на продавача.",
  statuses: {
    prepared: "Подготвено",
    creating: "Стартиране на плащането",
    reconciling: "Проверка на плащането",
    requires_payment_method: "Необходим е метод за плащане",
    requires_action: "Необходимо е удостоверяване",
    processing: "Обработва се",
    paid: "Платено",
    cancelling: "Проверка на отказа",
    cancelled: "Отказано",
    quarantined: "Необходимо е съгласуване",
    refund_pending: "Чака възстановяване",
    refunded: "Възстановено",
    disputed: "Оспорено",
    reconciliation: "Необходимо е съгласуване",
    pending: "Чака",
    ready: "Готова за получаване",
    collected: "Получена",
    blocked: "Получаването е блокирано",
    transferred: "Преводът е потвърден",
    reversed: "Преводът е обърнат",
  },
};
export function paymentText(language: PaymentLanguage) {
  return language === "bg" ? bg : en;
}
export function paymentError(code: string, language: PaymentLanguage) {
  const t = paymentText(language);
  return code === "CONFLICT"
    ? t.conflict
    : ["FORBIDDEN", "UNAUTHENTICATED", "NOT_FOUND"].includes(code)
      ? t.denied
      : t.failed;
}
