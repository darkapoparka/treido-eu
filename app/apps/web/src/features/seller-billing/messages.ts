export function billingText(language: "bg" | "en") {
  return language === "bg"
    ? {
        title: "План и фактури",
        current: "Текущ план",
        free: "Безплатен",
        pro: "Pro",
        proposed: "Предложение: месечен Pro",
        unavailable:
          "Платените действия са недостъпни до одобрени условия, цени, данъчна настройка и връзка с доставчика.",
        verified:
          "Достъпът следва потвърден платен период. Връщането от Stripe не доказва плащане.",
        preservation:
          "При изтичане или понижаване запазваме обявите, черновите, екипа и поръчките. Ограниченията важат за нови действия.",
        active: "Активни обяви",
        drafts: "Чернови",
        seats: "Места в екипа",
        variants: "Варианти на обява",
        imports: "Редове на импорт",
        history: "Дни история",
        export: "Търговски експорт",
        yes: "Да",
        no: "Не",
        invoices: "История на фактурите",
        empty: "Няма потвърдени фактури.",
        openInvoice: "Отвори фактура в Stripe",
        checkout: "Прегледай абонамент в Stripe",
        portal: "Данни за плащане в Stripe",
        cancel: "Спри подновяването в края на периода",
        cancelConfirm: "Потвърди спиране на подновяването",
        cancelReview:
          "Платеният достъп остава до края на потвърдения период. Ново плащане няма да бъде повторено при неясен резултат.",
        preview: "Прегледай промяна на плана",
        confirmChange: "Приемам прегледаната сума и промяна на плана",
        estimate: "Сума за тази промяна",
        estimateNote:
          "С потвърждението разрешаваш плащане с текущата карта за показаната промяна. Запазваме датата на пропорционалното изчисление. Ако прегледаните условия са променени, е нужен нов преглед. При непълно плащане планът не се променя.",
        recoveryTitle: "Възстановяване на заявка",
        reference: "Номер за справка",
        reconcile: "Провери актуалното състояние в Stripe",
        abandon: "Откажи тази промяна",
        abandonConfirm: "Потвърди отказа",
        abandonReview:
          "Нова промяна е възможна само след потвърден отказ на фактурата. Ако плащането вече е минало, отказът няма да го отмени или възстанови.",
        legacyRecovery:
          "Стара заявка през портала може още да действа, дори връзката да е скрита. Не можем безопасно да я отменим тук. Провери състоянието или запази номер за помощ; новите промени остават блокирани.",
        unknownRecovery:
          "Резултатът още е неясен. Не повтаряме плащането и не освобождаваме заявката по таймер.",
        escalate: "Запази номер за помощ",
        supportSaved:
          "Номерът е запазен. Предай го на поддръжката; съобщение не е изпратено автоматично.",
        support: "Свържи се с поддръжката",
        back: "Назад",
        recover: "Провери първоначалната заявка",
        pending: "Проверяваме резултата. Не започвай друго плащане.",
        open: "Продължи първоначалната заявка в Stripe",
        refresh: "Обнови",
        error:
          "Действието е недостъпно или разрешението е променено. Провери първоначалната заявка.",
        version: "Версия",
        terms: "Условия",
        until: "Платен достъп до",
        observed: "Проверено",
        status: "Състояние",
        ended: "Подновяването е спряно",
        checking: "Проверяваме профила…",
        denied: "Профилът е променен. Обнови страницата.",
        loading: "Зареждаме плана…",
      }
    : {
        title: "Plan and invoices",
        current: "Current plan",
        free: "Free",
        pro: "Pro",
        proposed: "Proposed monthly Pro",
        unavailable:
          "Paid actions are unavailable until terms, prices, tax configuration and provider bindings are approved.",
        verified:
          "Access follows a verified paid interval. Returning from Stripe does not prove payment.",
        preservation:
          "Expiry or downgrade preserves listings, drafts, team members and orders. Limits apply to new actions.",
        active: "Active listings",
        drafts: "Drafts",
        seats: "Team seats",
        variants: "Variants per listing",
        imports: "Rows per import",
        history: "History days",
        export: "Commercial export",
        yes: "Yes",
        no: "No",
        invoices: "Invoice history",
        empty: "No verified invoices.",
        openInvoice: "Open invoice in Stripe",
        checkout: "Review subscription in Stripe",
        portal: "Payment details in Stripe",
        cancel: "Stop renewal at period end",
        cancelConfirm: "Confirm stopping renewal",
        cancelReview:
          "Paid access remains until the verified interval ends. An uncertain result will not repeat a payment.",
        preview: "Preview plan change",
        confirmChange: "Accept reviewed amount and change plan",
        estimate: "Amount for this change",
        estimateNote:
          "Confirming authorizes payment with your current card for the displayed change. We retain the proration date. Changed reviewed terms require a new preview. Incomplete payment does not change the plan.",
        recoveryTitle: "Request recovery",
        reference: "Reference",
        reconcile: "Check current Stripe state",
        abandon: "Abandon this change",
        abandonConfirm: "Confirm abandonment",
        abandonReview:
          "A replacement is possible only after the invoice is confirmed void. If payment already succeeded, abandonment does not undo or refund it.",
        legacyRecovery:
          "An older portal request may still act even when its link is hidden. We cannot safely cancel it here. Check its state or save a support reference; further changes remain blocked.",
        unknownRecovery:
          "The outcome remains uncertain. We do not repeat payment or release the request on a timer.",
        escalate: "Save support reference",
        supportSaved:
          "Reference saved. Share it with support; no message was sent automatically.",
        support: "Contact support",
        back: "Back",
        recover: "Check original request",
        pending: "Reconciling the result. Do not start another payment.",
        open: "Continue original request in Stripe",
        refresh: "Refresh",
        error:
          "The action is unavailable or authority changed. Check the original request.",
        version: "Version",
        terms: "Terms",
        until: "Paid access until",
        observed: "Observed",
        status: "Status",
        ended: "Renewal is stopped",
        checking: "Checking your account…",
        denied: "The account changed. Refresh this page.",
        loading: "Loading your plan…",
      };
}
