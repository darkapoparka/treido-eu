import "server-only";
import { notFound, redirect } from "next/navigation";
import { readVerifiedIdentity } from "../../server/identity/clerk.server";
import { parseShippingContinuation } from "./integration";
/** Same existing verified session/sign-in flow, with this new route's strict
 * continuation. Root's existing sign-in consumer must ACK this allowlist. */
export async function requireShippingPageIdentity(path: string) {
  const continuation = parseShippingContinuation(path);
  if (!continuation) notFound();
  const identity = await readVerifiedIdentity();
  if (!identity)
    redirect("/sign-in?returnTo=" + encodeURIComponent(continuation));
  return identity;
}
