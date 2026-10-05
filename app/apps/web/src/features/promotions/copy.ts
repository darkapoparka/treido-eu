import type { Language, ProductId, CampaignState, StopReason } from "./model";
export function promotionCopy(language: Language) {
  const bg = language === "bg";
  const ui = bg
    ? {
        title: "Промотиране",
        intro:
          "Промотирането е отделна покупка. Не гарантира продажби, показвания или позиция и не се подновява автоматично.",
        unavailable:
          "Покупките на промотиране още не са достъпни. Цените по-долу са предложения, а не активни оферти.",
        newDraft: "Нова чернова",
        listing: "Артикул",
        product: "Вид промотиране",
        create: "Запази чернова",
        review: "Преглед на текущите условия",
        purchase: "Потвърди отделната покупка",
        acknowledge:
          "Прочетох тези условия, точната обща сума и правилата за спиране. Потвърждавам тази еднократна покупка.",
        reason: "Причина",
        pause: "Спри временно",
        cancel: "Откажи промотирането",
        recheck: "Провери отново",
        refresh: "Обнови",
        retry: "Опитай отново",
        recover: "Провери първоначалната заявка",
        unknown:
          "Резултатът е неизвестен. Проверете същата заявка, преди да направите нова.",
        retryOriginal: "Повтори същата заявка",
        accepted: "Заявката е потвърдена. Показва се текущото състояние.",
        empty: "Няма запазени промотирания.",
        noListings:
          "Няма ваши артикули за подготовка. Добавете артикул чрез обичайния редактор.",
        notEligible: "В момента не отговаря на условията за показване",
        proposal: "Предложена цена",
        total: "Точна обща сума, с включени данъци",
        interval: "Закупен период",
        pendingInterval:
          "Периодът още не е започнал. Плащането и текущият капацитет трябва да бъдат потвърдени.",
        capacity: "Текущ капацитет",
        available: "Свободно място",
        waitlist: "Местата са заети; чакащите не се таксуват",
        full: "Няма свободен капацитет",
        checking: "Проверка на текущия достъп…",
        denied: "Достъпът е променен. Изберете продавач отново.",
        failed:
          "Достъпът или операцията не могат да бъдат проверени. Опитайте отново.",
        conflict:
          "Записът или прегледът са променени. Обновете и прегледайте текущите условия.",
        invalid: "Проверете въведените данни.",
        limit: "Лимитът или капацитетът е достигнат.",
        metrics: "Записани събития",
        impressions: "Показвания",
        clicks: "Кликвания",
        inquiries: "Свързани запитвания",
        metricNote:
          "Броят включва само приети, уникални събития по правилото visible-v1. Това не е обещана аудитория или доказателство, че промотирането е причинило продажба. Неинструментираните действия не се приписват.",
        truncated: "Показани са най-новите 30 записа. Това не е пълна история.",
        expiry: "Прегледът е валиден до",
        back: "Към артикулите",
        receipt: "Условия при покупката",
        stopNote:
          "Спирането не доказва възстановяване на сума. Неизвестен резултат от доставчика остава за проверка.",
        observed: "Последна проверка",
        noTerms: "Няма одобрени условия за покупка.",
        reasonLabel: "Причина за спиране",
        history:
          "Хронологията и условията се пазят. Промотирането не може да се прехвърля към друг артикул.",
      }
    : {
        title: "Promotions",
        intro:
          "A promotion is a separate purchase. It guarantees no sales, views or ranking and does not renew automatically.",
        unavailable:
          "Promotion purchases are not available yet. The prices below are proposals, not active offers.",
        newDraft: "New draft",
        listing: "Listing",
        product: "Promotion product",
        create: "Save draft",
        review: "Review current terms",
        purchase: "Confirm separate purchase",
        acknowledge:
          "I have read these terms, the exact total and stopping rules. I confirm this one-time purchase.",
        reason: "Reason",
        pause: "Pause",
        cancel: "Cancel promotion",
        recheck: "Recheck",
        refresh: "Refresh",
        retry: "Retry",
        recover: "Check original request",
        unknown:
          "The result is unknown. Check the same request before starting another.",
        retryOriginal: "Retry same request",
        accepted: "Request acknowledged. Current state is shown.",
        empty: "No saved promotions.",
        noListings:
          "You have no listings to prepare. Add an item through the ordinary editor.",
        notEligible: "Currently ineligible for delivery",
        proposal: "Proposed price",
        total: "Exact total, tax included",
        interval: "Purchased interval",
        pendingInterval:
          "The interval has not started. Payment and current capacity must be confirmed first.",
        capacity: "Current capacity",
        available: "Capacity available",
        waitlist: "Capacity is occupied; waiting sellers are not charged",
        full: "No capacity available",
        checking: "Checking current access…",
        denied: "Access has changed. Choose your seller again.",
        failed: "Access or this operation could not be checked. Try again.",
        conflict:
          "The record or review changed. Refresh and review current terms.",
        invalid: "Check your input.",
        limit: "The limit or capacity has been reached.",
        metrics: "Recorded events",
        impressions: "Impressions",
        clicks: "Clicks",
        inquiries: "Linked inquiries",
        metricNote:
          "Counts include only accepted, unique events under visible-v1. They are not promised reach or proof that a promotion caused a sale. Uninstrumented actions are not attributed.",
        truncated:
          "Showing the latest 30 records. This is not a complete history.",
        expiry: "Review expires",
        back: "Back to listings",
        receipt: "Terms accepted at purchase",
        stopNote:
          "Stopping does not prove a refund. Unknown provider outcomes remain under review.",
        observed: "Last checked",
        noTerms: "No approved purchase terms are available.",
        reasonLabel: "Stop reason",
        history:
          "History and terms are retained. A promotion cannot be moved to another listing.",
      };
  const products: Record<ProductId, string> = bg
    ? {
        bump_once_v1: "Еднократно обновяване",
        category_spotlight_7d_v1: "Спонсорирана ротация в категория • 7 дни",
        home_spotlight_7d_v1: "Спонсорирана ротация в откриването • 7 дни",
      }
    : {
        bump_once_v1: "One eligible freshness event",
        category_spotlight_7d_v1: "Category sponsored rotation • 7 days",
        home_spotlight_7d_v1: "Discovery sponsored rotation • 7 days",
      };
  const states: Record<CampaignState, string> = bg
    ? {
        draft: "Чернова",
        awaiting_payment: "Очаква плащане",
        scheduled: "Планирано",
        active: "Активно",
        paused: "Спряно временно",
        completed: "Завършено",
        cancelled: "Отказано",
        reconciling: "Резултатът се проверява",
      }
    : {
        draft: "Draft",
        awaiting_payment: "Awaiting payment",
        scheduled: "Scheduled",
        active: "Active",
        paused: "Paused",
        completed: "Completed",
        cancelled: "Cancelled",
        reconciling: "Reconciling",
      };
  const reasons: Record<StopReason, string> = bg
    ? {
        seller_choice: "По избор на продавача",
        listing_unavailable: "Артикулът не е наличен или допустим",
        moderation: "Модерация",
        seller_restricted: "Ограничен продавач",
        platform_failure: "Платформата не може да достави",
        provider_uncertain: "Непотвърден резултат от доставчика",
        expired: "Периодът е изтекъл",
        payment_failed: "Плащането е спряно",
        operator_safety: "Операторско спиране за безопасност",
      }
    : {
        seller_choice: "Seller choice",
        listing_unavailable: "Listing unavailable or ineligible",
        moderation: "Moderation",
        seller_restricted: "Seller restricted",
        platform_failure: "Platform unable to deliver",
        provider_uncertain: "Provider outcome uncertain",
        expired: "Interval ended",
        payment_failed: "Payment stopped",
        operator_safety: "Operator safety stop",
      };
  return { ui, products, states, reasons };
}
