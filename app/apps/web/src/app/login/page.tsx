import {
  readCatalog,
  referencePreviewEnabled,
} from "../../features/catalog/queries.server";
import { pageLocale } from "../../features/locale/page-locale.server";
import { redirect } from "next/navigation";
import { parseSellContinuation } from "../../features/sellers/sell-entry";
import { parseBuyerContinuation } from "../../features/library/buyer-continuation";
import { parseWorkspaceContinuation } from "../../features/sellers/workspace-continuation";
import { LoginPage } from "../../features/account/support";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    lang?: string | string[];
    returnTo?: string | string[];
  }>;
}) {
  if (!referencePreviewEnabled()) {
    const query = await searchParams;
    const target = new URLSearchParams({ lang: await pageLocale(query.lang) });
    const selling = parseSellContinuation(query.returnTo);
    const continuation = selling.ok
      ? selling.continuation.target
      : (parseBuyerContinuation(query.returnTo) ??
        parseWorkspaceContinuation(query.returnTo));
    if (continuation) target.set("returnTo", continuation);
    redirect("/sign-in?" + target);
  }
  await readCatalog();
  return <LoginPage />;
}
