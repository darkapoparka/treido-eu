import { exportInsights } from "../../../../../../features/insights/export-route.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ sellerId: string }> },
) {
  const { sellerId } = await context.params;
  return exportInsights(request, { kind: "seller", sellerId });
}
