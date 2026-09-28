import "server-only";
import { cookies } from "next/headers";
import { referencePreviewEnabled } from "../queries.server";
import { referenceScenarioCookie, resolveReferenceScenario } from "./scenarios";

export async function readReferenceScenario() {
  // The cookie is only a named fixture selector. It cannot enable the preview,
  // authenticate a person, or provide arbitrary client-controlled data.
  if (!referencePreviewEnabled()) return undefined;
  const name = (await cookies()).get(referenceScenarioCookie)?.value;
  const scenario = resolveReferenceScenario(name);
  return scenario ? { name, ...scenario } : undefined;
}
