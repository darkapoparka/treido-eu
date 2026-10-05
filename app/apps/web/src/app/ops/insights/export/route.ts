import { exportInsights } from "../../../../features/insights/export-route.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return exportInsights(request, { kind: "operator" });
}
