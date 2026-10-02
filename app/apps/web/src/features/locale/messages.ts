import regional from "./region-messages.json";
import publication from "./publication-messages.json";
import messaging from "../messaging/messages.json";
import trust from "../trust/messages.json";
import captions from "./caption-messages.json";
import discoveryUI from "./discoveryUI-messages.json";
import accountUI from "./accountUI-messages.json";
import commerceUI from "./commerceUI-messages.json";
import languagePrompt from "./language-prompt-messages.json";
import account from "./account-messages.json";

const en = {
  scope: {
    label: "Listings from",
    title: "Seller type",
    personal: "Personal",
    business: "Businesses",
    all: "All sellers",
    compactAll: "All",
    pending: "Loading the selected seller scope…",
    unavailable: "Discovery by seller type is not connected yet.",
    explanation:
      "This preview uses reference data. There are no verified results for the selected seller type.",
    reset: "Browse all",
    store:
      "Seller scope applies to discovery. This reference storefront keeps its named seller.",
  },
  navigation: {
    profile: "Profile",
    notifications: "Notifications",
    deals: "Deals",
    following: "Following",
    saved: "Saved",
    minis: "Minis",
    home: "Home",
    search: "Search",
    explore: "Explore",
    orders: "Orders",
    chat: "Chat",
    back: "Go back",
    cart: "Open cart",
    main: "Main navigation",
  },
  search: {
    products: "Search products",
    placeholder: "Search or ask anything",
    submit: "Submit search",
    close: "Close search",
    clear: "Clear search",
    photos: "Add photos",
    removePhoto: "Remove selected photo",
    selectedPhoto: "Selected photo",
    filter: "Filter",
    origin: "Sells from",
    deals: "Your deals",
  },
  preferences: {
    title: "Language & location",
    language: "Language",
    languageNote:
      "Your browser sets the initial language. Your saved choice takes priority.",
    location: "Browsing location",
    locationPlaceholder: "City or area",
    locationNote:
      "Leave empty to browse everywhere. Changing language keeps your chosen area.",
    detected: "Approximate location",
    useSuggested: "Use suggested city",
    unavailable:
      "Automatic location is unavailable in this local preview. You can enter a city or area.",
    approximate:
      "The network location can be inaccurate. It is a suggestion; it does not change your search or delivery address.",
    save: "Save preferences",
    cancel: "Cancel",
  },
};
type TranslationShape<T> = {
  [K in keyof T]: T[K] extends string ? string : TranslationShape<T[K]>;
};
export type Messages = TranslationShape<typeof en>;
const bg: Messages = {
  scope: {
    label: "Обяви от",
    title: "Вид продавач",
    personal: "Частни лица",
    business: "Бизнеси",
    all: "Всички продавачи",
    compactAll: "Всички",
    pending: "Зареждане на избрания вид продавач…",
    unavailable: "Търсенето по вид продавач още не е свързано.",
    explanation:
      "Този преглед използва примерни данни. Няма потвърдени резултати за избрания вид продавач.",
    reset: "Разгледай всички",
    store:
      "Изборът важи за търсенето. Отвореният примерен магазин остава същият.",
  },
  navigation: {
    profile: "Профил",
    notifications: "Известия",
    deals: "Оферти",
    following: "Следвани",
    saved: "Запазени",
    minis: "Minis",
    home: "Начало",
    search: "Търсене",
    explore: "Разгледай",
    orders: "Поръчки",
    chat: "Чат",
    back: "Назад",
    cart: "Отвори количката",
    main: "Основна навигация",
  },
  search: {
    products: "Търси артикули",
    placeholder: "Търси или задай въпрос",
    submit: "Търси",
    close: "Затвори търсенето",
    clear: "Изчисти търсенето",
    photos: "Добави снимки",
    removePhoto: "Премахни избраната снимка",
    selectedPhoto: "Избрана снимка",
    filter: "Филтри",
    origin: "Продава от",
    deals: "Твоите оферти",
  },
  preferences: {
    title: "Език и местоположение",
    language: "Език",
    languageNote:
      "Първоначалният език е от браузъра. Запазеният ти избор има предимство.",
    location: "Място за търсене",
    locationPlaceholder: "Град или район",
    locationNote:
      "Остави празно, за да разглеждаш навсякъде. Смяната на езика запазва избрания район.",
    detected: "Приблизително местоположение",
    useSuggested: "Използвай предложения град",
    unavailable:
      "Автоматичното местоположение не е достъпно в този локален преглед. Можеш да въведеш град или район.",
    approximate:
      "Местоположението от мрежата може да е неточно. То е предложение и не променя търсенето или адреса ти за доставка.",
    save: "Запази настройките",
    cancel: "Отказ",
  },
};
export const messages = {
  bg: {
    ...bg,
    languagePrompt: languagePrompt.bg,
    messaging: messaging.bg,
    publication: publication.bg,
    trust: trust.bg,
    captions: captions.bg,
    discoveryUI: discoveryUI.bg,
    accountUI: accountUI.bg,
    commerceUI: commerceUI.bg,
    account: account.bg,
    preferences: { ...bg.preferences, ...regional.bg },
  },
  en: {
    ...en,
    languagePrompt: languagePrompt.en,
    messaging: messaging.en,
    publication: publication.en,
    trust: trust.en,
    captions: captions.en,
    discoveryUI: discoveryUI.en,
    accountUI: accountUI.en,
    commerceUI: commerceUI.en,
    account: account.en,
    preferences: { ...en.preferences, ...regional.en },
  },
};
