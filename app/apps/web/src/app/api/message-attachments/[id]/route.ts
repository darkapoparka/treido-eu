import { getDatabase } from "../../../../server/db/database";
import { requireVerifiedIdentity } from "../../../../server/identity/clerk.server";
import { requireBackendBindings } from "../../../../server/config/backend-bindings.server";
import { uploadAttachment } from "../../../../features/message-attachments/commands.server";
import { deliverAttachment } from "../../../../features/message-attachments/delivery.server";
import { ATTACHMENT_LIMITS } from "../../../../features/message-attachments/model";
import { SellerError } from "../../../../features/sellers/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "cache-control": "private, no-store, max-age=0",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "cross-origin-resource-policy": "same-origin",
};
function input(request: Request, id: string) {
  const url = new URL(request.url),
    revision = Number(url.searchParams.get("revision") ?? 1);
  if (
    [...url.searchParams.keys()].some(
      (k) => !["sellerId", "threadId", "revision"].includes(k),
    )
  )
    throw new SellerError("INVALID_INPUT");
  const seller = url.searchParams.get("sellerId");
  return {
    id,
    threadId: url.searchParams.get("threadId"),
    sellerId: seller === "buyer" ? null : seller,
    revision,
  };
}
function failure(error: unknown) {
  const code = error instanceof SellerError ? error.code : "NOT_AVAILABLE";
  return Response.json(
    { ok: false, code },
    {
      status:
        code === "UNAUTHENTICATED"
          ? 401
          : code === "INVALID_INPUT"
            ? 400
            : code === "CONFLICT"
              ? 409
              : code === "NOT_AVAILABLE"
                ? 503
                : 404,
      headers,
    },
  );
}
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const identity = await requireVerifiedIdentity();
    const bytes = await deliverAttachment(
      getDatabase(),
      identity,
      input(request, (await ctx.params).id),
    );
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...headers,
        "content-type": "image/webp",
        "content-length": String(bytes.length),
        "content-disposition": "inline; filename=image.webp",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
export async function PUT(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    // Cookie-authenticated upload mutation must originate from the configured application.
    const identity = await requireVerifiedIdentity();
    if (
      request.headers.get("x-treido-subject") !== identity.subject ||
      request.headers.get("origin") !==
        requireBackendBindings().application.origin
    )
      throw new SellerError("FORBIDDEN");
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(
        request.headers.get("content-type") ?? "",
      )
    )
      throw new SellerError("INVALID_INPUT");
    const length = Number(request.headers.get("content-length"));
    if (
      !Number.isSafeInteger(length) ||
      length < 1 ||
      length > ATTACHMENT_LIMITS.bytes
    )
      throw new SellerError("INVALID_INPUT");
    const reader = request.body?.getReader();
    if (!reader) throw new SellerError("INVALID_INPUT");
    const parts: Uint8Array[] = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > ATTACHMENT_LIMITS.bytes) {
          await reader.cancel();
          throw new SellerError("INVALID_INPUT");
        }
        parts.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    if (total !== length) throw new SellerError("INVALID_INPUT");
    const data = await uploadAttachment(
      getDatabase(),
      identity,
      input(request, (await ctx.params).id),
      Buffer.concat(parts),
    );
    return Response.json({ ok: true, data }, { headers });
  } catch (error) {
    return failure(error);
  }
}
