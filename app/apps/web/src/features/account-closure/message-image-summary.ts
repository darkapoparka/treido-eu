export type MessageImageSummary = {
  version: "message-image-lifecycle-v1";
  description: { bg: string; en: string };
  handling: "retain" | "remove";
  delaySeconds: number | null;
  removedObjects: number;
  retainedObjects: number;
};
export const messageImageNotice = {
  en: "Message images need a separately reviewed communication rule. Only your personal images covered by that rule may be removed. Business, counterpart, case, commerce and legally held evidence is retained. Message history is preserved; removed images show as unavailable. Cancellation is available before effects begin. No retention period is assumed.",
  bg: "Снимките в съобщения изискват отделно прегледано правило за комуникацията. Могат да се премахват само Вашите лични снимки, обхванати от него. Бизнес данни, чужди снимки и доказателства по случаи, сделки и правни задържания се запазват. Историята на съобщенията остава; премахнатите снимки се показват като недостъпни. Отказ е възможен преди започване на действията. Не се приема автоматичен срок за съхранение.",
};
