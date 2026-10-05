import type { Language, RecipientField } from "./model";
const en = {
  title: "Shipping review",
  unavailable: "Shipping is not available for this purchase yet.",
  back: "Back to payments",
  carrier: "Shipping option",
  recipient: "Recipient details",
  purpose:
    "I have read why these recipient details are needed and how they are retained.",
  prepare: "Review these details and costs",
  accept: "Accept these shipping terms",
  agree: "I have reviewed the recipient, every displayed cost and these terms.",
  items: "Items",
  shipping: "Shipping",
  buyerFee: "Buyer fee",
  tax: "Tax",
  total: "Total payable",
  sellerFee: "Seller platform fee (included in the payment)",
  includedUnknown: "Included; separate tax amount is not specified",
  included: "Included in the displayed prices",
  extra: "Added to the total",
  terms: "Shipping terms",
  rights: "Cancellation and return terms",
  refundTerms: "Refund treatment",
  costValidity: "Cost validity",
  reviewUntil: "Accept and continue from this review before",
  tariffUntil:
    "The approved tariff covers the original payment deadline through",
  retention: "Recipient use and retention",
  pending: "Saving…",
  failed: "The request could not be completed. Your input is retained.",
  unknown:
    "The result is not confirmed. Check the original request before starting another.",
  recover: "Check original request",
  cancel: "Stop an unrecorded request",
  canceled: "The unrecorded request is stopped. You can make a new selection.",
  accepted: "These original shipping terms have been accepted.",
  expired:
    "This review has expired. Its original cost and deadline are unchanged.",
  recipientUnavailable:
    "Recipient details are not available under the current purpose and retention rules.",
  paymentUnavailable: "Payment for this shipping review is not available yet.",
  payment: "Continue to the payable quote",
  manual:
    "Dispatch information is reported by the seller. Receipt is confirmed separately by the buyer.",
  fields: {
    name: "Recipient name",
    phone: "Contact phone",
    address: "Street and address",
    city: "City",
    postalCode: "Postal code",
    officeCode: "Collection office reference",
  } satisfies Record<RecipientField, string>,
};
const bg: typeof en = {
  title: "Преглед на доставката",
  unavailable: "Доставката още не е достъпна за тази покупка.",
  back: "Към плащанията",
  carrier: "Вариант за доставка",
  recipient: "Данни за получателя",
  purpose:
    "Прочетох защо са нужни тези данни за получателя и как се съхраняват.",
  prepare: "Преглед на данните и разходите",
  accept: "Приеми тези условия за доставка",
  agree: "Прегледах получателя, всички показани разходи и тези условия.",
  items: "Артикули",
  shipping: "Доставка",
  buyerFee: "Такса за купувача",
  tax: "Данък",
  total: "Общо за плащане",
  sellerFee: "Такса на продавача към платформата (включена в плащането)",
  includedUnknown: "Включен; отделната данъчна сума не е посочена",
  included: "Включен в показаните цени",
  extra: "Добавен към общата сума",
  terms: "Условия за доставка",
  rights: "Условия за отказ и връщане",
  refundTerms: "Условия за възстановяване",
  costValidity: "Валидност на разходите",
  reviewUntil: "Приеми и продължи от този преглед преди",
  tariffUntil: "Одобрената тарифа покрива първоначалния срок за плащане до",
  retention: "Използване и съхранение на данните за получателя",
  pending: "Записване…",
  failed: "Заявката не може да бъде изпълнена. Въведените данни са запазени.",
  unknown:
    "Резултатът не е потвърден. Провери първоначалната заявка, преди да започнеш друга.",
  recover: "Провери първоначалната заявка",
  cancel: "Спри незаписана заявка",
  canceled: "Незаписаната заявка е спряна. Можеш да направиш нов избор.",
  accepted: "Тези първоначални условия за доставка са приети.",
  expired: "Прегледът е изтекъл. Първоначалните разходи и срок са запазени.",
  recipientUnavailable:
    "Данните за получателя не са достъпни според текущата цел и правилата за съхранение.",
  paymentUnavailable:
    "Плащане за този преглед на доставката още не е достъпно.",
  payment: "Продължи към офертата за плащане",
  manual:
    "Данните за изпращане са посочени от продавача. Получаването се потвърждава отделно от купувача.",
  fields: {
    name: "Име на получателя",
    phone: "Телефон за контакт",
    address: "Улица и адрес",
    city: "Град",
    postalCode: "Пощенски код",
    officeCode: "Номер на офис за получаване",
  },
};
export function shippingText(language: Language) {
  return language === "bg" ? bg : en;
}
