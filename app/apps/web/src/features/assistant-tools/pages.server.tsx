import "server-only";
import { connection } from "next/server";
import { backendConfigured } from "../sellers/backend-status.server";
import { referencePreviewEnabled } from "../catalog/queries.server";
import { pageLocale } from "../locale/page-locale.server";
import { ToolUnavailable } from "../shopping-tools/tool-ui";
import { parseAssistantContinuation } from "./continuation";
import { CompatibilityScreen } from "./compatibility-screen";
import { SellHelperScreen } from "./sell-helper-screen";
import { assistantCopy } from "./copy";
type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
async function pageInput(
  searchParams: PageProps["searchParams"],
  path: string,
) {
  await connection();
  const source = await searchParams,
    locale = await pageLocale(source.lang),
    params = new URLSearchParams();
  for (const [key, value] of Object.entries(source))
    for (const item of Array.isArray(value) ? value : [value])
      if (item !== undefined) params.append(key, item);
  if (!params.has("lang")) params.set("lang", locale);
  const continuation = parseAssistantContinuation(
    path + "?" + params.toString(),
  );
  return {
    locale,
    continuation,
    params: continuation
      ? new URL(continuation, "https://treido.invalid").searchParams
      : null,
  };
}
export async function CompatibilityPage({ searchParams }: PageProps) {
  const input = await pageInput(searchParams, "/minis/compatibility");
  if (referencePreviewEnabled() || !backendConfigured() || !input.params)
    return (
      <ToolUnavailable
        title={assistantCopy[input.locale].compatibility}
        error={input.params ? "unavailable" : "invalid"}
      />
    );
  return (
    <CompatibilityScreen
      initialIds={input.params.getAll("listing")}
      initialCategory={input.params.get("categoryId") ?? ""}
      continuation={input.continuation ?? "/minis/compatibility"}
    />
  );
}
export async function SellHelperPage({ searchParams }: PageProps) {
  const input = await pageInput(searchParams, "/minis/sell-helper");
  if (referencePreviewEnabled() || !backendConfigured() || !input.params)
    return (
      <ToolUnavailable
        title={assistantCopy[input.locale].sellHelper}
        error={input.params ? "unavailable" : "invalid"}
      />
    );
  return (
    <SellHelperScreen
      initialSeller={input.params.get("sellerId") ?? ""}
      initialDraft={input.params.get("draftId") ?? ""}
      continuation={input.continuation ?? "/minis/sell-helper"}
    />
  );
}
