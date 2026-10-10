// Isolated component transport; never imported by an application route.
import { CatalogueImports } from "../apps/web/src/features/catalogue-import";
import { CatalogueImportDetail } from "../apps/web/src/features/catalogue-import/detail";
import { SellerInventory } from "../apps/web/src/features/inventory";
import type { ImportIndex } from "../apps/web/src/features/catalogue-import/queries.server";
import type { ImportView } from "../apps/web/src/features/catalogue-import/model";
import type { InventoryIndex } from "../apps/web/src/features/inventory/index-model";
import { BuyerSavedPage } from "../apps/web/src/features/library/page";
import React from "react";
import { createRoot } from "react-dom/client";
import { LocaleProvider } from "../apps/web/src/features/locale/provider";
import { DiscoveryProvider } from "../apps/web/src/features/discovery/state";
import { Marketplace } from "../apps/web/src/features/discovery/marketplace";
import { PublishedProductDetail } from "../apps/web/src/features/discovery/published-detail";
import { InventoryEditor } from "../apps/web/src/features/inventory/editor";
import { BuyerCartPage } from "../apps/web/src/features/buyer-cart/page";
import {
  OfferPanel,
  OfferMessageCard,
} from "../apps/web/src/features/offers/panel";
import { ShopSurface } from "../apps/web/src/features/discovery/hydration-boundary";
import {
  AdminShell,
  type AdminSeller,
} from "../apps/web/src/features/sellers/admin-shell";
import { Workspace } from "../apps/web/src/features/sellers/workspace";
import type {
  InventoryView,
  PublicInventory,
} from "../apps/web/src/features/inventory/model";
import type { BuyerCart } from "../apps/web/src/features/buyer-cart/model";
import type { OfferMessage } from "../apps/web/src/features/offers/model";
import type { DiscoveryInput } from "../apps/web/src/features/catalog/discovery-input";
import type {
  PublicDiscoveryPage,
  PublicSeller,
} from "../apps/web/src/features/catalog/public-discovery-model";
import type { PublishedListing } from "../apps/web/src/features/catalog/published-model";
import "../apps/web/src/features/account/account.css";
import "../apps/web/src/features/commerce/continuation.css";
declare global {
  interface Window {
    __marketplace: {
      locale: "bg" | "en";
      input: DiscoveryInput;
      page?: PublicDiscoveryPage;
      seller?: PublicSeller;
      home: boolean;
      info: boolean;
      listing?: PublishedListing;
      library?: boolean;
      actorSubject?: string;
      inventory?: PublicInventory | null;
      paymentEntryAvailable?: boolean;
      inventoryEditor?: InventoryView;
      importIndex?: ImportIndex;
      importDetail?: ImportView;
      inventoryIndex?: InventoryIndex;
      adminSeller?: AdminSeller;
      cart?: BuyerCart;
      offers?: { threadId: string; sellerId: string | null };
      offerMessages?: OfferMessage[];
    };
  }
}
const data = window.__marketplace;
createRoot(document.getElementById("root")!).render(
  <LocaleProvider initial={{ locale: data.locale, locationSuggestion: null }}>
    <DiscoveryProvider
      initial={{
        viewedProducts: [],
        viewedItems: [],
        cart: [],
        saved: [],
        collections: [],
        followed: [],
      }}
    >
      {(data.importIndex || data.importDetail || data.inventoryIndex) &&
      data.actorSubject &&
      data.adminSeller ? (
        <AdminShell sellers={[data.adminSeller]}>
          {data.importIndex ? (
            <CatalogueImports
              initial={data.importIndex}
              actorSubject={data.actorSubject}
            />
          ) : data.importDetail ? (
            <CatalogueImportDetail
              initial={data.importDetail}
              actorSubject={data.actorSubject}
            />
          ) : (
            <SellerInventory
              initial={data.inventoryIndex!}
              actorSubject={data.actorSubject}
            />
          )}
        </AdminShell>
      ) : data.inventoryEditor && data.actorSubject && data.adminSeller ? (
        <AdminShell sellers={[data.adminSeller]}>
          <Workspace title={data.inventoryEditor.title} language={data.locale}>
            <InventoryEditor
              initial={data.inventoryEditor}
              actorSubject={data.actorSubject}
            />
          </Workspace>
        </AdminShell>
      ) : data.cart ? (
        <BuyerCartPage initial={data.cart} status="ready" />
      ) : data.offers && data.actorSubject ? (
        <ShopSurface className="shop-page">
          <OfferPanel
            threadId={data.offers.threadId}
            scope={{ sellerId: data.offers.sellerId }}
            actorSubject={data.actorSubject}
            onChanged={() => {}}
          />
          <div data-offer-messages>
            {data.offerMessages?.map((value, index) => (
              <OfferMessageCard key={index} value={value} />
            ))}
          </div>
        </ShopSurface>
      ) : data.library ? (
        <BuyerSavedPage following={location.pathname === "/following"} />
      ) : data.listing ? (
        <PublishedProductDetail
          listing={data.listing}
          inventory={data.inventory}
          paymentEntryAvailable={data.paymentEntryAvailable === true}
        />
      ) : (
        <Marketplace
          input={data.input}
          page={data.page}
          seller={data.seller}
          home={data.home}
          info={data.info}
        />
      )}
    </DiscoveryProvider>
  </LocaleProvider>,
);
