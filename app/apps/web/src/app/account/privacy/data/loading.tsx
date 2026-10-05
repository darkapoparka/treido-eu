import { pageLocale } from "../../../../features/locale/page-locale.server";
import { privacyCopy } from "../../../../features/account-privacy/copy";
export default async function Loading() {
  const locale = await pageLocale(undefined);
  return <p role="status">{privacyCopy[locale === "en" ? "en" : "bg"].busy}</p>;
}
