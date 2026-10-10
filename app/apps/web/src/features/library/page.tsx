"use client";
/* eslint-disable @next/next/no-img-element -- Current publication media uses the existing versioned, authorization-checked image route. */
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { ShopSurface } from "../discovery/hydration-boundary";
import {
  FloatingNav,
  IconButton,
  consumeSheetHistory,
} from "../discovery/components";
import { SourceLink } from "../discovery/return-navigation";
import { Icon } from "../discovery/icons";
import { SavedCard } from "../discovery/saved-card";
import { BuyerFollowing } from "../discovery/following";
import { LibraryProvider, useBuyerLibrary } from "./provider";
import { LibraryLoadState } from "./feedback";
import {
  ListingCollectionButton,
  ListingSaveButton,
  SellerFollowButton,
} from "./controls";
import {
  LibraryCollectionDialog,
  type CollectionPanel,
} from "./collection-dialog";
import s from "./library.module.css";
import "../discovery/saved.css";
import "../discovery/buyer-surface.css";

export function BuyerSavedPage({ following = false }: { following?: boolean }) {
  const params = useSearchParams();
  return (
    <LibraryProvider
      query={{
        view: following ? "following" : "saved",
        collectionId: following ? null : params.get("collection"),
        cursor: params.get("cursor"),
      }}
    >
      <BuyerLibraryContent following={following} />
    </LibraryProvider>
  );
}
function BuyerLibraryContent({ following }: { following: boolean }) {
  const library = useBuyerLibrary(),
    t = useTranslations("library"),
    locale = useLocale();
  const router = useRouter(),
    params = useSearchParams();
  const [panel, setPanel] = useState<CollectionPanel | null>(null);
  const selected = params.get("collection"),
    addTo = params.get("addTo");
  const collection = library.view?.collections.find(
    (row) => row.id === selected,
  );
  const adding = library.view?.collections.find((row) => row.id === addTo);
  const route = following ? "/following" : "/saved";
  function href(
    options: { collection?: string; addTo?: string; cursor?: string } = {},
  ) {
    const next = new URLSearchParams({ lang: locale });
    if (options.collection) next.set("collection", options.collection);
    if (options.addTo) next.set("addTo", options.addTo);
    if (options.cursor) next.set("cursor", options.cursor);
    return route + "?" + next.toString();
  }
  function navigate(options: { collection?: string; addTo?: string } = {}) {
    const replace = consumeSheetHistory();
    setPanel(null);
    (replace ? router.replace : router.push)(href(options));
  }
  const ready = library.status === "ready" && library.view;
  if (following)
    return (
      <BuyerFollowing
        follows={ready ? library.view!.follows : []}
        ready={!!ready}
        state={<LibraryLoadState controller={library} />}
        control={(id) => <SellerFollowButton id={id} />}
        pagination={
          ready && (library.view!.nextCursor || params.has("cursor")) ? (
            <nav className={s.pagination} aria-label={t("pagination")}>
              {params.has("cursor") && (
                <SourceLink className="pill" href={href()}>
                  {t("first")}
                </SourceLink>
              )}
              {library.view!.nextCursor && (
                <SourceLink
                  className="primary"
                  href={href({ cursor: library.view!.nextCursor })}
                  startAtTop
                >
                  {t("next")}
                </SourceLink>
              )}
            </nav>
          ) : undefined
        }
      />
    );
  return (
    <ShopSurface
      className={
        "shop-page saved-page saved-library android-live android-saved buyer-public " +
        (collection ? "saved-collection " : "") +
        (adding ? "saved-selection " : "") +
        s.page
      }
    >
      <header className="section-heading saved-heading">
        <h1>
          {adding
            ? t("addFromSaved")
            : (collection?.name ?? t(following ? "following" : "saved"))}
          {collection && (
            <small aria-label={t("private")}>
              <Icon name="lock" />
            </small>
          )}
        </h1>
        {ready &&
          !following &&
          (adding ? (
            <button
              className="saved-selection-done"
              type="button"
              onClick={() => navigate({ collection: adding.id })}
            >
              {t("done")}
            </button>
          ) : (
            <IconButton
              icon={collection ? "more" : "plus"}
              label={t(collection ? "collectionOptions" : "createCollection")}
              onClick={() => setPanel(collection ? "options" : "create")}
            />
          ))}
      </header>
      {!ready ? (
        <>
          <LibraryLoadState controller={library} />
          {library.status === "error" && (
            <SourceLink
              className="pill"
              href={href()}
              preserveDiscoveryContext={false}
            >
              {t("first")}
            </SourceLink>
          )}
        </>
      ) : (
        <>
          {!following && !collection && !adding &&
            (library.view!.items.length > 0 || library.view!.collections.length > 0) && (
            <>
              <h2>{t("collections")}</h2>
              <div
                className={
                  "collection-rail " +
                  (library.view!.collections.length ? "has-collections" : "")
                }
              >
                {library.view!.collections.map((item) => (
                  <SourceLink
                    className="collection-tile"
                    key={item.id}
                    href={href({ collection: item.id })}
                    preserveDiscoveryContext={false}
                    startAtTop
                  >
                    <div
                      className={!item.covers.length ? s.emptyCover : undefined}
                    >
                      {item.covers.length ? (
                        item.covers.map((url) => (
                          <img key={url} src={url} alt="" />
                        ))
                      ) : (
                        <Icon name="heart" />
                      )}
                    </div>
                    <span className="collection-tile-copy">
                      <small>
                        <Icon name="lock" />
                        {t("private")}
                      </small>
                      <b>{item.name}</b>
                      <small>{t("count", { count: item.count })}</small>
                    </span>
                  </SourceLink>
                ))}
                <button
                  className="create-collection-tile"
                  type="button"
                  onClick={() => setPanel("create")}
                >
                  <span>
                    <Icon name="plus" />
                    {t("createCollection")}
                  </span>
                  <div className={s.emptyCover}>
                    <Icon name="heart" />
                  </div>
                </button>
              </div>
            </>
          )}
          {collection && (
            <div className={s.actions}>
              <button
                className="pill"
                type="button"
                onClick={() => navigate({ addTo: collection.id })}
              >
                <Icon name="plus-circle" />
                {t("addFromSaved")}
              </button>
              <span className={s.muted}>
                {t("count", { count: library.view!.total })}
              </span>
            </div>
          )}
          {
            <div className="product-grid saved-grid">
              {library.view!.items.map((item) => {
                const included =
                  !!adding && item.collectionIds.includes(adding.id);
                const choose = () => {
                  if (adding)
                    void library.execute({
                      kind: "collectionItem",
                      collectionId: adding.id,
                      listingId: item.id,
                      included: !included,
                    });
                };
                return (
                  <div key={item.id}>
                    {item.card ? (
                      <SavedCard
                        publicMedia
                        product={{ ...item.card, storeId: item.card.seller.id }}
                        seller={item.card.seller.name}
                        selected={included}
                        pending={library.busy}
                        onSelect={adding ? choose : undefined}
                        saveControl={
                          adding ? (
                            <IconButton
                              className={
                                "save-button " +
                                (included ? "saved-active" : "")
                              }
                              icon={included ? "check" : "plus"}
                              label={
                                t(
                                  included
                                    ? "removeFromCollection"
                                    : "saveToCollection",
                                ) +
                                " " +
                                item.card.title
                              }
                              pressed={included}
                              filled={false}
                              disabled={library.busy}
                              onClick={choose}
                            />
                          ) : (
                            <ListingSaveButton
                              id={item.id}
                              title={item.card.title}
                            />
                          )
                        }
                      />
                    ) : (
                      <article className={s.unavailable}>
                        <Icon name="heart" />
                        <strong>{t("unavailableListing")}</strong>
                        <p>{t("unavailableListingNote")}</p>
                        <ListingSaveButton
                          id={item.id}
                          title={t("unavailableListing")}
                          overlay={false}
                        />
                        {adding && included && (
                          <button
                            type="button"
                            className="pill"
                            disabled={library.busy}
                            onClick={choose}
                          >
                            {t("removeFromCollection")}
                          </button>
                        )}
                      </article>
                    )}
                    {!adding && (
                      <div className={s.itemActions}>
                        <ListingCollectionButton id={item.id} />
                        {collection && (
                          <button
                            type="button"
                            className="pill"
                            disabled={library.busy}
                            onClick={() =>
                              void library.execute({
                                kind: "collectionItem",
                                collectionId: collection.id,
                                listingId: item.id,
                                included: false,
                              })
                            }
                          >
                            {t("removeFromCollection")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          }
          {(following
            ? !library.view!.follows.length
            : !library.view!.items.length) && (
            <div className={collection || adding ? "empty-state" : "saved-empty-source"}>
              <Icon name={following ? "storefront" : "heart"} />
              <h2>
                {t(
                  following
                    ? "emptyFollowing"
                    : collection
                      ? "emptyCollection"
                      : "emptySaved",
                )}
              </h2>
              {!collection && (
                <p>{t(following ? "emptyFollowingNote" : "emptySavedNote")}</p>
              )}
              <SourceLink
                className="primary"
                href={"/search?lang=" + locale}
                preserveDiscoveryContext={false}
              >
                {t("goShopping")}
              </SourceLink>
            </div>
          )}
          {(library.view!.nextCursor || params.has("cursor")) && (
            <nav className={s.pagination} aria-label={t("pagination")}>
              {params.has("cursor") && (
                <SourceLink
                  className="pill"
                  href={href({ collection: collection?.id, addTo: adding?.id })}
                  preserveDiscoveryContext={false}
                  startAtTop
                >
                  {t("first")}
                </SourceLink>
              )}
              {library.view!.nextCursor && (
                <SourceLink
                  className="primary"
                  href={href({
                    collection: collection?.id,
                    addTo: adding?.id,
                    cursor: library.view!.nextCursor,
                  })}
                  preserveDiscoveryContext={false}
                  startAtTop
                >
                  {t("next")}
                </SourceLink>
              )}
            </nav>
          )}
        </>
      )}
      {panel && (
        <LibraryCollectionDialog
          key={panel + (collection?.id ?? "")}
          panel={panel}
          collection={collection}
          onPanel={setPanel}
          onClose={() => setPanel(null)}
          onCreated={(id) => navigate({ addTo: id })}
          onDeleted={() => navigate()}
          onAdd={() => collection && navigate({ addTo: collection.id })}
        />
      )}
      <FloatingNav
        back
        marketplace
        onBack={adding ? () => navigate({ collection: adding.id }) : undefined}
      />
    </ShopSurface>
  );
}
