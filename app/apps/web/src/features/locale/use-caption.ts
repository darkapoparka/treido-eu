import { useTranslations, useFormatter } from "next-intl";
import { captionKeys } from "./caption-keys";
/** Use at known enum/label render sites. Stored values are never translated. */
export function useCaption() {
  const t = useTranslations("captions");
  const format = useFormatter();
  return (value: string | number) => {
    if (typeof value === "number") return format.number(value);
    const key = Object.hasOwn(captionKeys, value)
      ? captionKeys[value as keyof typeof captionKeys]
      : undefined;
    return key ? t(key) : value;
  };
}
