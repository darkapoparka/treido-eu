import messages from "./messages.json";
export type ImportMessageKey = keyof typeof messages.en;
export function importMessageKey(value: unknown): ImportMessageKey {
  return typeof value === "string" && Object.hasOwn(messages.en, value)
    ? (value as ImportMessageKey)
    : "NOT_AVAILABLE";
}
