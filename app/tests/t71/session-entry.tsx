import React from "react";
import { createRoot } from "react-dom/client";
import { BuyerSavedPage } from "../../apps/web/src/features/library/page";
import { BuyerCartPage } from "../../apps/web/src/features/buyer-cart/page";
import { CartMutationButton } from "../../apps/web/src/features/buyer-cart/mutation-button";
const surface = new URLSearchParams(location.search).get("surface");
const id = "00000000-0000-4000-8000-000000000001";
const cart = {
  actorKey: "A".repeat(64),
  revision: 1,
  lines: [
    {
      skuId: id,
      quantity: 1,
      state: "ready" as const,
      item: {
        listingId: id,
        skuId: id,
        sellerId: id,
        sellerName: "A-private-seller",
        title: "A-private-cart-line",
        photo: "/A-private-cover.svg",
        options: {},
        mode: "unique" as const,
        publicationRevision: 2,
        priceMinor: 500,
        available: 1,
      },
    },
  ],
};
createRoot(document.getElementById("root")!).render(
  surface === "button" ? (
    <CartMutationButton
      label="Add"
      operation={{
        kind: "add",
        listingId: id,
        skuId: id,
        publicationRevision: 2,
        quantity: 1,
      }}
    />
  ) : surface === "cart" ? (
    <BuyerCartPage initial={cart} initialSubject="A" status="ready" />
  ) : (
    <BuyerSavedPage following={surface === "following"} />
  ),
);
