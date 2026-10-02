import "server-only";
import type {
  ProductContext,
  ProductContextRequest,
} from "../product-context-model";
import { toCartProduct, toCartSeller } from "../../commerce/cart-catalog";
import {
  readReferenceProducts,
  readReferenceStores,
} from "./product-source.server";

const offerIds = [
  "black-conditioner-bag",
  "chocolate-body-bag",
  "shower-caddy",
  "solid-shave-butter",
];
/** Resolve only items used by this visitor's cart, saved covers and captured offer. */
export async function readReferenceProductContext(
  id: string,
  request: ProductContextRequest,
  scenario?: string,
): Promise<ProductContext> {
  const cartIds = [...new Set([id, ...request.cartIds])];
  const products = [...(await readReferenceProducts(cartIds, scenario))];
  if (products.some((product) => product.storeId === "kitsch")) {
    const offers = await readReferenceProducts(
      offerIds.filter((id) => !products.some((product) => product.id === id)),
      scenario,
    );
    products.push(...offers);
  }
  const [stores, covers] = await Promise.all([
    readReferenceStores(
      [...new Set(products.map((product) => product.storeId))],
      scenario,
    ),
    readReferenceProducts(request.coverIds, scenario),
  ]);
  return {
    cart: {
      products: products.map(toCartProduct),
      stores: stores.map(toCartSeller),
    },
    covers: covers.map((product) => ({
      id: product.id,
      image: product.images[0],
    })),
    resolvedCartIds: [
      ...new Set([...cartIds, ...products.map((product) => product.id)]),
    ],
    resolvedCoverIds: [...request.coverIds],
  };
}
