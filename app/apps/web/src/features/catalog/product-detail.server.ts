import "server-only";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cookies, headers } from "next/headers";
import { setTimeout as delay } from "node:timers/promises";
import { referencePreviewEnabled } from "./queries.server";
import { referenceCatalogDelay } from "./reference/replay-delay";
import { referenceScenarioCookie } from "./reference/scenarios";
import {
  parseProductContextRequest,
  validProductId,
  type ProductDetailPageView,
  type ProductContext,
} from "./product-context-model";

async function readLocalReferenceRequest() {
  await connection();
  // Match the owned preview launcher's local-only contract before importing data.
  if (!referencePreviewEnabled()) notFound();
  const replayDelay = referenceCatalogDelay(await headers(), true);
  if (replayDelay) await delay(replayDelay);
  return (await cookies()).get(referenceScenarioCookie)?.value;
}
/** Adapter selection is explicit. A future database adapter must implement this bounded result. */
export async function readProductDetail(
  id: string,
): Promise<ProductDetailPageView | undefined> {
  const scenario = await readLocalReferenceRequest();
  if (!validProductId(id)) return;
  const { readReferenceProductDetail } =
    await import("./reference/product-detail.server");
  return readReferenceProductDetail(id, scenario);
}

export async function readProductContext(
  id: string,
  input: unknown,
): Promise<ProductContext | undefined> {
  const scenario = await readLocalReferenceRequest();
  const request = parseProductContextRequest(input);
  if (!validProductId(id) || !request) return;
  const { readReferenceProducts } =
    await import("./reference/product-source.server");
  if (!(await readReferenceProducts([id], scenario)).length) return;
  const { readReferenceProductContext } =
    await import("./reference/product-context.server");
  return readReferenceProductContext(id, request, scenario);
}
