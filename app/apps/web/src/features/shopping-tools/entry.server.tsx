import "server-only";
import { ClerkProvider } from "@clerk/nextjs";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { getDatabase } from "../../server/db/database";
import { backendConfigured } from "../sellers/backend-status.server";
import { referencePreviewEnabled } from "../catalog/queries.server";
import { pageLocale } from "../locale/page-locale.server";
import { clerkLocalization } from "../locale/clerk-localization.server";
import { SellerError } from "../sellers/errors";
import { readDiscoveryInput } from "../catalog/discovery-input";
import { ComparisonProvider } from "./comparison-provider";
import { SavedSearchProvider } from "../saved-searches/provider";
import { ComparisonScreen } from "./comparison-screen";
import { Finder, FinderFailure, ToolUnavailable } from "./tool-ui";
import { searchToolCatalogue } from "./catalogue.server";
import { parseToolIntent, type ToolMode, type ToolIntent } from "./intent";
import { toolCopy } from "./copy";
export async function ToolSessionLayout({ children }: { children: ReactNode }) {
  if (referencePreviewEnabled() || !backendConfigured()) return children;
  const locale = await pageLocale(undefined);
  return (
    <ClerkProvider
      localization={await clerkLocalization(locale)}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      <ComparisonProvider>
        <SavedSearchProvider>{children}</SavedSearchProvider>
      </ComparisonProvider>
    </ClerkProvider>
  );
}
export type ToolPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
export async function FinderPage({
  searchParams,
  mode,
}: ToolPageProps & { mode: ToolMode }) {
  await connection();
  const source = await searchParams,
    locale = await pageLocale(source.lang),
    title =
      mode === "deal-finder" ? toolCopy[locale].deal : toolCopy[locale].find;
  if (referencePreviewEnabled() || !backendConfigured())
    return <ToolUnavailable title={title} />;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(source))
    for (const item of Array.isArray(value) ? value : [value])
      if (item !== undefined) params.append(key, item);
  if (!params.has("lang")) params.set("lang", locale);
  let initial: ToolIntent | null = null;
  let data: Awaited<ReturnType<typeof searchToolCatalogue>> | null = null;
  let issue: "invalid" | "unavailable" = "unavailable";
  try {
    initial = parseToolIntent(params.toString(), mode);
    data = await searchToolCatalogue(getDatabase(), params.toString(), mode);
  } catch (error) {
    issue =
      error instanceof SellerError && error.code === "INVALID_INPUT"
        ? "invalid"
        : "unavailable";
  }
  // Only data access belongs in the catch boundary. React render failures are
  // handled by the route's error.tsx rather than a misleading JSX try/catch.
  if (data) return <Finder data={data} mode={mode} />;
  if (!initial) {
    const parsed = readDiscoveryInput(params);
    initial = {
      discovery: {
        ...parsed.input,
        locale,
        sort: mode === "deal-finder" ? "price_asc" : parsed.input.sort,
      },
      handover: "any",
      availability: "any",
      cursor: null,
    };
  }
  return <FinderFailure initial={initial} mode={mode} error={issue} />;
}
export async function ComparisonPage() {
  await connection();
  const locale = await pageLocale(undefined);
  if (referencePreviewEnabled() || !backendConfigured())
    return <ToolUnavailable title={toolCopy[locale].compare} />;
  return <ComparisonScreen />;
}
