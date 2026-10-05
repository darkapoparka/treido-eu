import { getDatabase } from "../../../../server/db/database";
import { receiveStripeWebhook } from "../../../../features/payments/webhook.server";
import { SellerError } from "../../../../features/sellers/errors";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    return Response.json(await receiveStripeWebhook(getDatabase(), request), {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    // Never serialize raw provider payloads, signature headers or SDK errors.
    const status =
      error instanceof SellerError &&
      ["INVALID_INPUT", "FORBIDDEN", "CONFLICT"].includes(error.code)
        ? 400
        : 503;
    return Response.json(
      { received: false },
      { status, headers: { "cache-control": "private, no-store" } },
    );
  }
}
