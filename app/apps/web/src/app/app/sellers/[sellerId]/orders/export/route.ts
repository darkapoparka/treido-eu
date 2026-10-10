import { exportMerchantData } from "@/features/sellers/merchant-data-export.server";
export async function GET(request: Request, context: { params: Promise<{ sellerId: string }> }) {
  const { sellerId } = await context.params;
  return exportMerchantData(request, sellerId, "orders");
}
