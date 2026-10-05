import { getDatabase } from "../../../../../server/db/database";
import { assistantInputIdentity } from "../../../../../features/assistant-runs/identity.server";
import {
  readOwnedInputBytes,
  assertOwnedInputReadable,
} from "../../../../../features/assistant-runs/media.server";
import { uuid } from "../../../../../features/assistant-runs/model";
import { SellerError } from "../../../../../features/sellers/errors";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ assetId: string }> },
) {
  try {
    if (new URL(request.url).search) throw new SellerError("INVALID_INPUT");
    const id = uuid((await context.params).assetId),
      identity = await assistantInputIdentity(),
      database = getDatabase(),
      media = await readOwnedInputBytes(database, identity, id);
    const current = await assistantInputIdentity();
    if (current.subject !== identity.subject)
      throw new SellerError("UNAUTHENTICATED");
    // Rechecks current owner, consent, policy and expiry after storage I/O.
    await assertOwnedInputReadable(database, current, id);
    return new Response(new Uint8Array(media.bytes), {
      headers: {
        "content-type": media.mediaType,
        "content-length": String(media.bytes.length),
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    const denied =
      error instanceof SellerError &&
      ["FORBIDDEN", "NOT_FOUND", "INVALID_INPUT", "UNAUTHENTICATED"].includes(
        error.code,
      );
    return Response.json(
      { code: denied ? "NOT_FOUND" : "NOT_AVAILABLE" },
      {
        status: denied ? 404 : 503,
        headers: { "cache-control": "private, no-store" },
      },
    );
  }
}
