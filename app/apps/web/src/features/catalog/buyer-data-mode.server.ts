import "server-only";
import { cookies } from "next/headers";
import { referencePreviewEnabled, readCatalog } from "./queries.server";
import { notFound } from "next/navigation";
import { referenceScenarioCookie } from "./reference/scenarios";

/** Adapter selection only; the local QA cookie grants no resource authority. */
export async function readBuyerReferenceMode(): Promise<boolean> {
  if (!referencePreviewEnabled()) return false;
  return (
    (await cookies()).get(referenceScenarioCookie)?.value !== "public-data"
  );
}

/** Unsupported buyer leaves cannot re-enter replay after selecting genuine data. */
export async function readBuyerReferenceCatalog() {
  if (!(await readBuyerReferenceMode())) notFound();
  return readCatalog();
}
