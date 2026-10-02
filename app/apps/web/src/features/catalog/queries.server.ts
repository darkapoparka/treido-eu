import "server-only";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cookies, headers } from "next/headers";
import { setTimeout as delay } from "node:timers/promises";
import { referenceCatalogDelay } from "./reference/replay-delay";
import { referenceScenarioCookie } from "./reference/scenarios";
import { toSearchCatalog, type SearchCatalog } from "./search-catalog";
import type { Catalog } from "./types";
export function referencePreviewEnabled() {
  return (
    process.env.SHOP_REFERENCE_PREVIEW === "1" &&
    !process.env.VERCEL &&
    process.env.VERCEL_ENV !== "production" &&
    process.env.NODE_ENV !== "production"
  );
}
export async function readCatalog(): Promise<Catalog> {
  await connection();
  // Fail closed before loading reference data. No production adapter exists yet.
  if (!referencePreviewEnabled()) notFound();
  const replayDelay = referenceCatalogDelay(await headers(), true);
  if (replayDelay) await delay(replayDelay);
  const scenarioName = (await cookies()).get(referenceScenarioCookie)?.value;
  const { readReferenceCatalog } = await import("./reference/adapter.server");
  return readReferenceCatalog(scenarioName);
}
/** Search never receives detail bodies, full galleries or merchant policies. */
export async function readSearchCatalog(): Promise<SearchCatalog> {
  return toSearchCatalog(await readCatalog());
}
