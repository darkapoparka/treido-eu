import { readProductContext } from "@/features/catalog/product-detail.server";
import { parseProductContextRequest } from "@/features/catalog/product-context-model";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const url = new URL(request.url);
  const input = parseProductContextRequest({
    cartIds: url.searchParams.getAll("cart"),
    coverIds: url.searchParams.getAll("cover"),
  });
  const headers = { "Cache-Control": "private, no-store" };
  if (!input)
    return Response.json(
      { error: "Invalid product context request" },
      { status: 400, headers },
    );
  const { id } = await params;
  const context = await readProductContext(id, input);
  if (!context)
    return Response.json(
      { error: "Product not found" },
      { status: 404, headers },
    );
  return Response.json(context, { headers });
}
