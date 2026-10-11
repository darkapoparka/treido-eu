import { exportCustomerHistory } from "@/features/sellers/customer-history-export.server";
export async function GET(request: Request, context: { params: Promise<{ sellerId: string; id: string }> }) {
  const { sellerId, id } = await context.params;
  return exportCustomerHistory(request, sellerId, id);
}
