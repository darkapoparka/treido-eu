import "server-only";
import { connection } from "next/server";
import { backendConfigured } from "../sellers/backend-status.server";
import { referencePreviewEnabled } from "../catalog/queries.server";
import { pageLocale } from "../locale/page-locale.server";
import { ToolUnavailable } from "../shopping-tools/tool-ui";
import { parseGiftContinuation } from "./continuation";
import { GiftScreen } from "./screen";
import { giftCopy } from "./copy";
export async function GiftPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const source = await searchParams,
    locale = await pageLocale(source.lang),
    params = new URLSearchParams();
  for (const [key, value] of Object.entries(source))
    for (const v of Array.isArray(value) ? value : [value])
      if (v !== undefined) params.append(key, v);
  if (!params.has("lang")) params.set("lang", locale);
  const continuation = parseGiftContinuation(
    "/minis/gift-finder?" + params.toString(),
  );
  if (referencePreviewEnabled() || !backendConfigured() || !continuation)
    return (
      <ToolUnavailable
        title={giftCopy[locale].title}
        error={continuation ? "unavailable" : "invalid"}
      />
    );
  return <GiftScreen continuation={continuation} />;
}
