import "server-only";
import type { ProductDetailPageView } from "../product-context-model";
import { toProductDetailView } from "../product-detail-model";
import { resolveReferenceScenario } from "./scenarios";
import { readReferenceProductContext } from "./product-context.server";
import {
  readReferenceProducts,
  readReferenceRelatedProducts,
  readReferenceStores,
} from "./product-source.server";

export async function readReferenceProductDetail(
  id: string,
  scenario?: string,
): Promise<ProductDetailPageView | undefined> {
  const [product] = await readReferenceProducts([id], scenario);
  if (!product) return;
  const [seller] = await readReferenceStores([product.storeId], scenario);
  const shea = id === "shea-butter",
    bag = id === "shampoo-bag";
  const relatedIds = shea
    ? [
        "chocolate-body-bag",
        "sugar-body-scrub",
        "solid-shave-butter",
        "charcoal-body-wash",
      ]
    : bag
      ? ["black-conditioner-bag", "chocolate-body-bag"]
      : undefined;
  const related = relatedIds
    ? (await readReferenceProducts(relatedIds, scenario)).map((item) => ({
        ...item,
        ...(bag
          ? {
              images: [
                "/api/reference-media/pdp-bag-" + item.id + "-recommendation",
              ],
            }
          : {}),
        ...(shea ? { promotion: "$20 off order" } : {}),
        ...(shea && item.id === "chocolate-body-bag"
          ? { title: "Chocolate Body Wash Bar Bag", ratingCount: "748" }
          : {}),
      }))
    : seller
      ? await readReferenceRelatedProducts(product.storeId, id, scenario)
      : [];
  const seed = resolveReferenceScenario(scenario)?.discovery;
  const context = await readReferenceProductContext(
    id,
    {
      cartIds: [
        ...new Set(
          [...(seed?.cart ?? []), ...(seed?.later ?? [])].map(
            (line) => line.productId,
          ),
        ),
      ],
      coverIds: [
        ...new Set(
          (seed?.collections ?? []).flatMap((collection) =>
            collection.productIds.slice(0, 4),
          ),
        ),
      ],
    },
    scenario,
  );
  return {
    view: toProductDetailView(product, seller, related),
    // The client already has the current item. Do not serialize its variants twice.
    context: {
      ...context,
      cart: {
        ...context.cart,
        products: context.cart.products.filter(
          (item) => item.id !== product.id,
        ),
      },
    },
  };
}
