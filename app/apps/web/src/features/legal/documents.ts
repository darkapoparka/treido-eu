import type { Locale } from "../locale/locale";

export type LegalKind = "privacy" | "terms";
type ReviewSection = {
  title: string;
  paragraphs: readonly string[];
  pending: string;
};
type ReviewDocument = {
  status: "draft";
  title: string;
  sections: readonly ReviewSection[];
};

// Local review copy only. An approved publication needs a separately reviewed
// content change; no deployment setting can promote these drafts to final text.
export const legalDocuments = {
  en: {
    privacy: {
      status: "draft",
      title: "Privacy notice",
      sections: [
        {
          title: "Operator and contact",
          paragraphs: [
            "Treido is a marketplace for physical goods from personal and business sellers.",
            "Owner-supplied prospective operator details: Valentin Radev, Antonia Nikolaeva. The owner reports no company number. Legal roles and public identification are not yet confirmed; no joint-controller arrangement is assumed.",
            "Public contact: Roza 17, 9000 Varna, Bulgaria; +359899940960. Support and privacy enquiries: darkapoparka1@gmail.com.",
          ],
          pending:
            "Confirm the supplied names' legal roles and required public identification, the notice version and contact procedure. Confirm controller and any applicable representative/DPO details.",
        },
        {
          title: "Information and purposes",
          paragraphs: [
            "Google and Clerk handle Google sign-in and its basic identity permissions. Treido verifies the Clerk session and associates its records with a Clerk identifier.",
            "Depending on the features used, records include seller profiles/memberships, setup information, private drafts and submitted listings/photos, saved items/searches, carts, conversations/offers/attachments and purchase, fulfilment or case information. Public profiles and accepted publications are separate from private drafts/declarations.",
            "These flows provide account access, selling/buying tools, chosen publication, conversations/invitations, available purchases/fulfilment, reports and account requests, access restrictions and necessary evidence. Optional AI processes submitted input under an approved feature policy; suggestions do not themselves publish, send messages or purchase.",
          ],
          pending:
            "Review the lawful basis for each purpose, required information and any actual legitimate interest. Include only features actually enabled at launch.",
        },
        {
          title: "Recipients, device data and retention",
          paragraphs: [
            "Relevant information is available to public visitors, conversation participants, authorized business members and authorized fulfilment/support actors according to the feature and current permissions.",
            "The implementation uses Clerk/Google sign-in, Neon database/private storage and Vercel hosting. It supports Inngest, Resend invitations, Stripe payments/billing and AI Gateway/model providers; an implemented adapter alone does not prove active disclosure.",
            "Language/region cookies and device preferences/recovery buffers support the interface. Account closure checks policy and outstanding business, commerce and case obligations. The supported export is a selected current snapshot, not every record independently held by external providers.",
          ],
          pending:
            "Verify active services, agreements, processing locations and applicable EEA transfer safeguards; cookies/storage/logs and lifetimes; and category-specific retention/closure/backups. Do not infer EU-only processing or immediate universal deletion.",
        },
        {
          title: "Rights and notice changes",
          paragraphs: [
            "You may request access, correction, erasure, restriction or portability, and object where applicable. Where processing relies on consent, it can be withdrawn without changing earlier lawful processing. You may complain to a competent supervisory authority. Proportionate identity verification may be needed for requests.",
          ],
          pending:
            "Confirm the authority reference and request procedure, any applicable solely automated decisions/effects and material-change notification. Technical controls are not a compliance certification.",
        },
      ],
    },
    terms: {
      status: "draft",
      title: "Terms of use",
      sections: [
        {
          title: "Service and accounts",
          paragraphs: [
            "Treido provides discovery and available selling, communication and purchase tools for physical goods. Features depend on current permissions, listing eligibility and applicable provider/policy configuration.",
            "Owner-supplied prospective operator details: Valentin Radev, Antonia Nikolaeva. The owner reports no company number. Their legal roles and public identification remain unconfirmed.",
            "Public contact: Roza 17, 9000 Varna, Bulgaria; +359899940960. Support and privacy enquiries: darkapoparka1@gmail.com.",
            "Protect account access and provide accurate seller/item information. Act for a business only with authority. A personal-account label does not turn trading activity into a private sale. Mandatory consumer rights are not waived.",
          ],
          pending:
            "Approve legal roles, required public identification, contact procedure and version, Treido/seller/buyer contractual roles, sale formation, who supplies/fulfils goods, eligibility/age rules and applicable seller disclosures.",
        },
        {
          title: "Listings, payments and reports",
          paragraphs: [
            "Proposed rule for approval: offer only goods/content you may lawfully share, describe defects and price truthfully, and do not submit illegal/stolen/counterfeit/dangerous goods, abuse, fraud or attempts to bypass access.",
            "Review displayed amounts, currency, fees and conditions before a paid action. A cart, accepted offer, reservation or redirect does not prove provider-confirmed payment; offers/reservations may have separate contractual effects.",
            "Use the relevant report/appeal workflows. A report does not automatically remove content and an appeal does not automatically restore it.",
          ],
          pending:
            "Approve prohibited-content rules and necessary limited content licence; fulfilment, fees/taxes, cancellation/returns/refunds/disputes and active paid-plan terms; moderation grounds, procedures, human/automated roles, reasons and monitored complaints contact. No invented commission, escrow, buyer guarantee or response deadline.",
        },
        {
          title: "Closure, changes and contact",
          paragraphs: [
            "Closure follows approved outstanding-obligation and retention handling. The privacy notice describes the relevant information flows.",
          ],
          pending:
            "Approve termination, material changes, liability and applicable law/disputes without blanket consumer-rights exclusions. The public email and phone remain available when sign-in is unavailable.",
        },
      ],
    },
  },
  bg: {
    privacy: {
      status: "draft",
      title: "Уведомление за поверителност",
      sections: [
        {
          title: "Оператор и контакт",
          paragraphs: [
            "Treido е платформа за физически стоки от частни и бизнес продавачи.",
            "Предоставени от собственика данни за бъдещите оператори: Valentin Radev, Antonia Nikolaeva. Собственикът посочва, че няма фирмен номер. Правните роли и публичната идентификация не са потвърдени; не се предполага споразумение за съвместни администратори.",
            "Публичен контакт: ул. Роза 17, 9000 Варна, България; +359899940960. За поддръжка и въпроси относно личните данни: darkapoparka1@gmail.com.",
          ],
          pending:
            "Потвърдете правните роли и необходимата публична идентификация, версията на уведомлението и процедурата за контакт. Потвърдете администратора и представител/ДЛЗД, ако са приложими.",
        },
        {
          title: "Информация и цели",
          paragraphs: [
            "Google и Clerk обработват входа с Google и основните разрешения за идентификация. Treido проверява сесията в Clerk и свързва собствените записи с идентификатор в Clerk.",
            "Според използваните функции записите включват профили/членства, настройки, частни чернови и подадени обяви/снимки, запазени артикули/търсения, колички, разговори/оферти/прикачени файлове и покупки, изпълнение или сигнали. Публичните профили и приетите публикации са отделни от частните чернови/декларации.",
            "Тези процеси предоставят достъп, инструменти за продажби/покупки, избрана публикация, разговори/покани, налични покупки/доставки, сигнали и искания, ограничения на достъпа и необходими доказателства. Допълнителният AI обработва подадения вход при одобрена политика; предложенията сами не публикуват, изпращат съобщения или купуват.",
          ],
          pending:
            "Прегледайте правното основание за всяка цел, задължителната информация и действителния легитимен интерес. Включете само активните функции при старта.",
        },
        {
          title: "Получатели, локални данни и запазване",
          paragraphs: [
            "Съответната информация е достъпна за посетители, участници в разговор, упълномощени бизнес членове и лица с права за изпълнение/поддръжка според функцията и текущите права.",
            "Реализацията използва Clerk/Google за вход, Neon за база/частно съхранение и Vercel за хостинг. Поддържа Inngest, Resend покани, Stripe плащания/абонаменти и AI Gateway/модели; наличен адаптер не доказва активно разкриване.",
            "Бисквитки за език/регион и локални предпочитания/буфери подпомагат интерфейса. Закриването проверява политика и неприключили бизнес, търговски и свързани със сигнали задължения. Износът е избрана текуща снимка, не всички записи при външни доставчици.",
          ],
          pending:
            "Проверете активните услуги, договори, местоположения и гаранции за трансфери извън ЕИП; бисквитки/съхранение/логове и срокове; запазване/закриване/резервни копия по категории. Без предположение за обработване само в ЕС или незабавно пълно изтриване.",
        },
        {
          title: "Права и промени",
          paragraphs: [
            "Можете да поискате достъп, корекция, изтриване, ограничаване или преносимост и да възразите, когато е приложимо. При основание съгласие то може да се оттегли, без да променя предходното законосъобразно обработване. Можете да подадете жалба до компетентен надзорен орган. За исканията може да е нужна пропорционална проверка на самоличността.",
          ],
          pending:
            "Потвърдете надзорен орган и процедура, приложими изцяло автоматизирани решения/ефекти и уведомяване за съществени промени. Техническите контроли не са сертификат за съответствие.",
        },
      ],
    },
    terms: {
      status: "draft",
      title: "Условия за използване",
      sections: [
        {
          title: "Услуга и акаунти",
          paragraphs: [
            "Treido предоставя откриване и налични инструменти за продажби, общуване и покупки на физически стоки. Функциите зависят от текущите права, допустимостта на обявата и настройките на доставчика/политиката.",
            "Предоставени от собственика данни за бъдещите оператори: Valentin Radev, Antonia Nikolaeva. Собственикът посочва, че няма фирмен номер. Правните им роли и публичната идентификация остават непотвърдени.",
            "Публичен контакт: ул. Роза 17, 9000 Варна, България; +359899940960. За поддръжка и въпроси относно личните данни: darkapoparka1@gmail.com.",
            "Пазете достъпа и предоставяйте точни данни за продавача/стоката. Действайте за бизнес само с право. Личният акаунт не превръща търговската дейност в частна продажба. Задължителните потребителски права не се отменят.",
          ],
          pending:
            "Одобрете правни роли, необходима публична идентификация, процедура за контакт и версия, договорните роли на Treido/продавач/купувач, сключването на продажбата, доставчика на стоката, допустимост/възраст и приложимите разкрития за продавачите.",
        },
        {
          title: "Обяви, плащания и сигнали",
          paragraphs: [
            "Предложено правило за одобрение: предлагайте само стоки/съдържание, които можете законно да споделяте, описвайте вярно дефекти и цена; без незаконни/откраднати/фалшифицирани/опасни стоки, обиди, измами или заобикаляне на достъпа.",
            "Прегледайте суми, валута, такси и условия преди платено действие. Количка, приета оферта, резервация или пренасочване не доказва потвърдено плащане; офертите/резервациите може да имат отделни договорни последици.",
            "Използвайте съответните сигнали/обжалвания. Сигналът не премахва автоматично съдържание, а обжалването не го възстановява автоматично.",
          ],
          pending:
            "Одобрете забранено съдържание и необходим ограничен лиценз; доставка, такси/данъци, отказ/връщане/възстановяване/спорове и активни планове; основания, процедури, човешки/автоматизирани роли, мотиви и обслужван контакт за жалби. Без измислена комисиона, ескроу, гаранция за купувача или срок за отговор.",
        },
        {
          title: "Закриване, промени и контакт",
          paragraphs: [
            "Закриването следва одобреното обработване на задължения и запазване. Уведомлението за поверителност описва информационните потоци.",
          ],
          pending:
            "Одобрете прекратяване, съществени промени, отговорност и приложимо право/спорове без общо изключване на потребителски права. Публичните имейл и телефон остават достъпни при невъзможност за вход.",
        },
      ],
    },
  },
} as const satisfies Record<Locale, Record<LegalKind, ReviewDocument>>;
