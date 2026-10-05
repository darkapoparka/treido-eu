import "server-only";
import { connection } from "next/server";
import { backendConfigured } from "../sellers/backend-status.server";
import { referencePreviewEnabled } from "../catalog/queries.server";
import { pageLocale } from "../locale/page-locale.server";
import { validId } from "../selling/draft-model";
import { ToolUnavailable } from "../shopping-tools/tool-ui";
import { SavedSearchManager } from "./manager";
import { searchCopy } from "./copy";
export async function SavedSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = await searchParams,
    locale = await pageLocale(params.lang);
  const invalid =
    Object.entries(params).some(
      ([key, value]) =>
        !["lang", "search", "updates", "filter", "q"].includes(key) ||
        Array.isArray(value) ||
        (value?.length ?? 0) > 1024,
    ) ||
    (params.search !== undefined && !validId(params.search)) ||
    (params.filter !== undefined &&
      !["all", "unread"].includes(String(params.filter))) ||
    (typeof params.q === "string" && params.q.length > 80);
  if (referencePreviewEnabled() || !backendConfigured() || invalid)
    return (
      <ToolUnavailable
        title={searchCopy[locale].title}
        error={invalid ? "invalid" : "unavailable"}
      />
    );
  return <SavedSearchManager />;
}
