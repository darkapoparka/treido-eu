"use client";
import { ShopSurface } from "./hydration-boundary";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import {
  SourceLink,
  rememberSourcePosition,
  restoreSourcePosition,
} from "./return-navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import "./saved.css";
import { KitschWordmark } from "./kitsch-wordmark";
import { SavedCard } from "./saved-card";
import { CollectionEditor } from "./collection-editor";
import { useSheetStages } from "./sheet-stages";
import { useRouter, useSearchParams } from "next/navigation";
import type { Catalog, SavedListing } from "../catalog/types";
import { resolveSavedListing } from "../catalog/types";
import {
  FloatingNav,
  IconButton,
  Sheet,
  consumeSheetHistory,
} from "./components";
import { Icon } from "./icons";
import { CartOverlay } from "../commerce/checkout";
import { useDiscovery } from "./state";
import { useAccount } from "../account/state";
import {
  SavedSelectionPreview,
  type SavedPreviewTransition,
} from "./saved-selection-preview";
import { useReducedMotion } from "./motion-preference";

export function Saved({ catalog }: { catalog: Catalog }) {
  const native = !!catalog.liveHomeStoreIds;
  const state = useDiscovery(),
    account = useAccount(),
    params = useSearchParams(),
    router = useRouter();
  const guest = native && !account.profile.email;
  const selected = params.get("collection");
  const collection = state.collections.find((item) => item.id === selected);
  const [modal, setModal] = useState("");
  const flow = useSheetStages({
    open: !!modal,
    initial: modal || "Collection options",
    onClose: () => setModal(""),
    onReopen: () => {
      submitting.current = false;
      setModal("Collection options");
    },
    onStart: () => {},
  });
  const view = params.get("view");
  const panel =
    view === "add"
      ? "Add from saved"
      : view === "ideas"
        ? "More ideas"
        : flow.active
          ? flow.stage
          : modal;
  const addMode = panel === "Add from saved" || panel === "More ideas";
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"Private" | "Public">("Private");
  const [notice, setNotice] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [previewTransition, setPreviewTransition] =
    useState<SavedPreviewTransition | null>(null);
  const previewSerial = useRef(0);
  const reducedMotion = useReducedMotion();
  const clearPreview = useCallback(() => setPreviewTransition(null), []);
  const finishPreview = useCallback((id: number) => {
    setPreviewTransition((current) => (current?.id === id ? null : current));
  }, []);
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const onPreference = () => {
      if (preference.matches) clearPreview();
    };
    window.addEventListener("popstate", clearPreview);
    preference.addEventListener("change", onPreference);
    return () => {
      window.removeEventListener("popstate", clearPreview);
      preference.removeEventListener("change", onPreference);
    };
  }, [clearPreview]);
  const editorRef = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const selectionScroll = useRef<number | null>(null);
  const wasSelecting = useRef(false);
  const returnControl = useRef(".find-ideas");
  const productFor = (id: string): SavedListing | undefined =>
    resolveSavedListing(catalog, id);
  const fromIds = (ids: readonly string[]) =>
    ids.flatMap((id) => {
      const item = productFor(id);
      return item ? [item] : [];
    });
  const products = fromIds(collection ? collection.productIds : state.saved);
  const ideas = fromIds([
    "idea-rice-wash",
    "idea-rosemary-bar",
    "idea-rosemary-bundle",
    "idea-purple-bundle",
    "idea-rosemary-liquid",
    "idea-jojoba",
  ]);
  const selectionProducts =
    panel === "More ideas" ? ideas : fromIds(state.saved);
  const selectedPreview =
    collection &&
    fromIds(collection.productIds).find((item) =>
      selectionProducts.some((option) => option.id === item.id),
    );
  const featured = catalog.stores.filter((store) =>
    products.some((product) => product.storeId === store.id),
  );
  const editing = panel === "Create collection" || panel === "Edit name";
  useEffect(() => {
    const entering = addMode && !wasSelecting.current;
    const leaving = !addMode && wasSelecting.current;
    wasSelecting.current = addMode;
    if (!entering && !leaving) return;
    if (entering && selectionScroll.current === null)
      selectionScroll.current =
        window.history.state?.shopSavedSelection?.returnScroll ?? 0;
    const frame = requestAnimationFrame(() => {
      window.scrollTo({
        top: entering ? 0 : (selectionScroll.current ?? 0),
        behavior: "instant",
      });
      if (leaving) {
        document
          .querySelector<HTMLElement>(returnControl.current)
          ?.focus({ preventScroll: true });
        selectionScroll.current = null;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [addMode]);
  // Same-page selection owns an explicit return entry. Consuming an options
  // sheet replaces that entry; Done/Back must not add a duplicate detail page.
  function navigate(id: string | null, nextView = "", created = false) {
    clearPreview();
    const next = new URLSearchParams();
    if (id) next.set("collection", id);
    if (nextView) next.set("view", nextView);
    const href = `/saved${next.size ? `?${next}` : ""}`;
    const consumed = consumeSheetHistory();
    if (nextView) {
      selectionScroll.current = created ? 0 : window.scrollY;
      returnControl.current =
        nextView === "ideas"
          ? ".find-ideas"
          : '[aria-label="Collection options"]';
      const historyState = {
        ...window.history.state,
        shopSavedSelection: {
          collection: id,
          created,
          returnScroll: selectionScroll.current,
        },
      };
      delete historyState.__NA;
      delete historyState._N;
      (consumed ? window.history.replaceState : window.history.pushState).call(
        window.history,
        historyState,
        "",
        href,
      );
    } else {
      // Collection views use the catalog already on this page. Keep their URL
      // transition local, like item selection, so deleting a collection cannot
      // render its missing-item state while waiting for an RSC response.
      const historyState = { ...window.history.state };
      delete historyState.shopSavedSelection;
      delete historyState.__NA;
      delete historyState._N;
      (consumed ? window.history.replaceState : window.history.pushState).call(
        window.history,
        historyState,
        "",
        href,
      );
    }
  }
  function finishSelection() {
    clearPreview();
    const entry = window.history.state?.shopSavedSelection;
    if (entry?.collection === selected && !entry.created) {
      router.back();
      return;
    }
    const next = new URLSearchParams();
    if (collection) next.set("collection", collection.id);
    const historyState = { ...window.history.state };
    delete historyState.shopSavedSelection;
    delete historyState.__NA;
    delete historyState._N;
    window.history.replaceState(
      historyState,
      "",
      `/saved${next.size ? `?${next}` : ""}`,
    );
  }
  function setPanel(value: string) {
    if (value === "Add from saved" || value === "More ideas") {
      if (!collection) return;
      const enter = () =>
        navigate(collection.id, value === "More ideas" ? "ideas" : "add");
      if (flow.active) flow.close(enter);
      else enter();
    } else if (!value) flow.close();
    else if (flow.active) flow.navigate(value);
    else setModal(value);
  }
  function beginCreation() {
    setName("");
    setVisibility("Private");
    submitting.current = false;
    setPanel("Create collection");
  }
  function choose(id: string) {
    const product = productFor(id);
    if (!collection || !product) return;
    clearPreview();
    if (
      !reducedMotion &&
      !collection.productIds.includes(id) &&
      product.images[0]
    ) {
      setPreviewTransition({
        id: ++previewSerial.current,
        previousImage: selectedPreview?.images[0],
      });
    }
    state.updateCollection(collection.id, {
      productIds: collection.productIds.includes(id)
        ? collection.productIds.filter((value) => value !== id)
        : [id, ...collection.productIds],
    });
  }
  const previousPanel = useRef("");
  useEffect(() => {
    const previous = previousPanel.current;
    previousPanel.current = panel;
    if (!flow.active || addMode) return;
    const frame = requestAnimationFrame(() => {
      const sheet =
        document.querySelector<HTMLDialogElement>(".saved-sheet[open]");
      const target = editing
        ? editorRef.current
        : panel === "Collection options"
          ? (sheet?.querySelector<HTMLElement>(
              '[data-collection-stage="' + CSS.escape(previous) + '"]',
            ) ??
            sheet?.querySelector<HTMLElement>(".collection-option-rows button"))
          : sheet?.querySelector<HTMLElement>(
              ".sheet-actions button, .form-submit",
            );
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [panel, editing, flow.active, addMode]);
  useEffect(() => {
    if (selected || addMode) return;
    const id = window.history.state?.shopSavedCollectionReturn;
    if (typeof id === "string")
      restoreSourcePosition(`[data-saved-collection="${CSS.escape(id)}"]`);
  }, [selected, addMode]);
  return (
    <ShopSurface
      className={`shop-page saved-page saved-library ${collection ? "saved-collection" : ""} ${addMode ? "saved-selection" : ""} ${native ? "android-live android-saved" : ""}`}
    >
      <header className="section-heading saved-heading">
        <h1 className={addMode && selectedPreview ? "sr-only" : undefined}>
          {addMode ? panel : collection ? collection.name : "Saved"}
          {!addMode && collection?.visibility === "Private" && (
            <small>
              <Icon name="lock" />
            </small>
          )}
        </h1>
        {addMode ? (
          <>
            {selectedPreview && (
              <SavedSelectionPreview
                image={selectedPreview.images[0]}
                count={collection?.productIds.length ?? 0}
                transition={reducedMotion ? null : previewTransition}
                onComplete={finishPreview}
              />
            )}
            <button className="saved-selection-done" onClick={finishSelection}>
              Done
            </button>
          </>
        ) : collection ? (
          <div className="saved-heading-actions">
            {collection.visibility === "Public" && (
              <IconButton
                icon="share"
                label="Share collection"
                onClick={() => setPanel("Share collection")}
              />
            )}
            <IconButton
              icon="more"
              label="Collection options"
              onClick={() => setPanel("Collection options")}
            />
          </div>
        ) : !guest && state.collections.length > 0 && !selected ? (
          <IconButton
            icon="plus"
            label="Create collection"
            onClick={beginCreation}
          />
        ) : null}
      </header>
      {selected && !collection ? (
        <p className="empty-state">
          This local collection is unavailable.{" "}
          <Link href="/saved">Return to Saved</Link>
        </p>
      ) : (
        <>
          {!guest &&
            !collection &&
            !addMode &&
            (products.length > 0 || state.collections.length > 0) && (
              <>
                <h2>
                  Collections{" "}
                  {state.collections.length > 0 && (
                    <span className="saved-heading-arrow" aria-hidden="true">
                      ›
                    </span>
                  )}
                </h2>
                <div
                  className={`collection-rail ${state.collections.length ? "has-collections" : ""}`}
                >
                  {state.collections.map((item) => (
                    <button
                      className="collection-tile"
                      data-saved-collection={item.id}
                      key={item.id}
                      onClick={() => {
                        window.history.replaceState(
                          {
                            ...window.history.state,
                            shopSavedCollectionReturn: item.id,
                          },
                          "",
                          location.href,
                        );
                        rememberSourcePosition(
                          `[data-saved-collection="${CSS.escape(item.id)}"]`,
                        );
                        navigate(item.id);
                        window.scrollTo({ top: 0, behavior: "instant" });
                      }}
                    >
                      <div>
                        {fromIds(item.productIds)
                          .slice(0, 6)
                          .map((product) => (
                            <img
                              key={product.id}
                              src={product.images[0]}
                              alt=""
                            />
                          ))}
                      </div>
                      <span className="collection-tile-copy">
                        <small>
                          <Icon
                            name={
                              item.visibility === "Private" ? "lock" : "globe"
                            }
                          />
                          {item.visibility}
                        </small>
                        <b>{item.name}</b>
                      </span>
                    </button>
                  ))}
                  <button
                    className="create-collection-tile"
                    onClick={beginCreation}
                  >
                    <span>
                      <Icon name="plus" />
                      Create collection
                    </span>
                    <div>
                      {products
                        .slice(0, state.collections.length ? 6 : 2)
                        .map((product) => (
                          <img
                            key={product.id}
                            src={product.images[0]}
                            alt=""
                          />
                        ))}
                    </div>
                  </button>
                </div>
              </>
            )}
          {collection &&
            !addMode &&
            (collection.collaborationPromptDismissed ? (
              <button
                className="invite-collaborators"
                onClick={() => setPanel("Invite collaborators")}
              >
                <span className="collection-person" aria-hidden="true">
                  {account.profile.avatar ? (
                    <img src={account.profile.avatar} alt="" />
                  ) : (
                    <span>{account.profile.firstName[0]}</span>
                  )}
                  <Icon name="plus" />
                </span>
                Invite collaborators
              </button>
            ) : (
              <section className="collection-invite-callout">
                <IconButton
                  icon="close"
                  label="Dismiss collaboration suggestion"
                  onClick={() =>
                    state.updateCollection(collection.id, {
                      collaborationPromptDismissed: true,
                    })
                  }
                />
                <strong>Collaborate with people you know</strong>
                <p>Shop together, plan events, and share gift ideas.</p>
                <button
                  className="primary"
                  onClick={() => setPanel("Invite collaborators")}
                >
                  Invite collaborators
                </button>
              </section>
            ))}
          <div className="product-grid saved-grid">
            {(addMode ? selectionProducts : products).map((product) => (
              <SavedCard
                key={product.id}
                product={product}
                seller={
                  catalog.stores.find((store) => store.id === product.storeId)
                    ?.name ?? product.sellerName
                }
                selected={collection?.productIds.includes(product.id)}
                onSelect={addMode ? () => choose(product.id) : undefined}
              />
            ))}
          </div>
          {collection && !addMode && (
            <>
              {!products.length && (
                <p className="collection-empty">
                  There are no items in this collection yet.{" "}
                  <button onClick={() => setPanel("Add from saved")}>
                    Add from saved
                  </button>
                </p>
              )}
              {featured.length > 0 && (
                <>
                  <h2 className="featured-heading">
                    Featured brands{" "}
                    <span className="saved-heading-arrow" aria-hidden="true">
                      ›
                    </span>
                  </h2>
                  <div className="featured-brands">
                    {featured.map((store) => (
                      <SourceLink
                        key={store.id}
                        className={`featured-brand ${store.id === "kitsch" ? "featured-kitsch" : ""}`}
                        href={`/stores/${store.id}`}
                        aria-label={`Visit ${store.name}`}
                      >
                        {store.id === "kitsch" ? (
                          <KitschWordmark />
                        ) : store.logo ? (
                          <img src={store.logo} alt={store.name} />
                        ) : (
                          <span>{store.name}</span>
                        )}
                      </SourceLink>
                    ))}
                  </div>
                </>
              )}
              <button
                className="find-ideas"
                onClick={() => setPanel("More ideas")}
              >
                <span>
                  <Icon name="plus-circle" />
                  Find more ideas
                </span>
                <div>
                  {ideas.map((product) => (
                    <img key={product.id} src={product.images[0]} alt="" />
                  ))}
                </div>
              </button>
            </>
          )}
          {!products.length && !collection && !addMode && (
            <div className="saved-empty-source">
              <div className="saved-sock-card">
                <img
                  src={
                    native
                      ? "/api/reference-media/live-empty-saved-mug"
                      : "/api/reference-media/saved-socks"
                  }
                  alt={native ? "" : "Socks"}
                />
                <Icon name="heart" filled />
              </div>
              <h2>You haven’t saved any items yet</h2>
              <p>
                Tap the heart icon on any item to save it and get notified if it
                drops in price{native ? "" : "."}
              </p>
              <Link className="primary" href="/">
                Go shopping
              </Link>
            </div>
          )}
          {addMode && selectionProducts.length === 0 && (
            <p className="collection-empty">
              No saved items are available to add.{" "}
              <Link href="/">Go shopping</Link>
            </p>
          )}
        </>
      )}
      <CartOverlay
        catalog={catalog}
        open={cartOpen}
        onClose={() => setCartOpen(false)}
      />
      <FloatingNav
        android={native}
        back
        fade
        cart={() => setCartOpen(true)}
        showCartWhenEmpty={
          !native && !products.length && !collection && !addMode
        }
        onBack={
          addMode
            ? finishSelection
            : collection
              ? () =>
                  window.history.length > 1
                    ? router.back()
                    : router.replace("/saved")
              : undefined
        }
      />
      <Sheet
        open={flow.active && !!panel && !addMode}
        manageHistory={false}
        headerless={editing}
        initialFocus=".collection-name-input, .collection-option-rows button, .sheet-actions button, .form-submit"
        className={`saved-sheet ${editing ? `collection-editor ${panel === "Edit name" ? "collection-editor-edit" : ""}` : panel === "Collection options" ? "collection-options-sheet" : panel === "Delete collection" ? "collection-delete-sheet" : panel === "Make public" ? "collection-public-sheet" : "collection-sharing-sheet"}`}
        title={
          panel === "Make public"
            ? "Anyone on Shop will be able to view this collection"
            : panel === "Delete collection"
              ? "Are you sure you want to delete this collection?"
              : panel
        }
        onClose={() => setPanel("")}
      >
        {editing ? (
          <CollectionEditor
            name={name}
            visibility={visibility}
            editing={panel === "Edit name"}
            thumbnails={products}
            inputRef={editorRef}
            onNameChange={setName}
            onVisibilityChange={setVisibility}
            onCancel={() => setPanel("")}
            onSave={() => {
              if (!name.trim() || submitting.current) return;
              submitting.current = true;
              if (panel === "Edit name" && collection) {
                flow.close(() =>
                  state.updateCollection(collection.id, { name: name.trim() }),
                );
              } else {
                flow.close(() => {
                  const id = state.createCollection(name.trim());
                  state.updateCollection(id, { visibility });
                  navigate(id, "add", true);
                });
              }
            }}
          />
        ) : panel === "Collection options" && collection ? (
          <div className="collection-option-rows">
            <button
              data-collection-stage="Edit name"
              onClick={() => {
                setName(collection.name);
                submitting.current = false;
                setPanel("Edit name");
              }}
            >
              <Icon name="edit" />
              Edit name
            </button>
            <button onClick={() => setPanel("Add from saved")}>
              <Icon name="plus-circle" />
              Add from saved
            </button>
            <button
              data-collection-stage="Make public"
              title="Changes local preview visibility only; nothing is published"
              onClick={() => {
                if (collection.visibility === "Private")
                  setPanel("Make public");
                else {
                  state.updateCollection(collection.id, {
                    visibility: "Private",
                  });
                  setNotice("Collection is now private");
                  setPanel("");
                }
              }}
            >
              <Icon
                name={collection.visibility === "Private" ? "globe" : "lock"}
              />
              Make collection{" "}
              {collection.visibility === "Private" ? "public" : "private"}
            </button>
            <button
              className="danger-text"
              data-collection-stage="Delete collection"
              onClick={() => setPanel("Delete collection")}
            >
              <Icon name="trash" />
              Delete collection
            </button>
          </div>
        ) : panel === "Make public" && collection ? (
          <>
            <p className="collection-confirm-copy">
              Your collection will be discoverable by others and may appear on
              the feed.
            </p>
            <span id="collection-public-boundary" className="sr-only">
              Local reference preview only. Nothing is published or shared.
              Sharing and invitation actions explain this service boundary.
            </span>
            <div className="sheet-actions">
              <button className="pill" onClick={() => setPanel("")}>
                Cancel
              </button>
              <button
                className="primary"
                aria-describedby="collection-public-boundary"
                title="Changes local preview visibility only; nothing is published"
                onClick={() => {
                  state.updateCollection(collection.id, {
                    visibility: "Public",
                  });
                  setPanel("");
                  setNotice("Collection is now public");
                }}
              >
                Make public
              </button>
            </div>
          </>
        ) : panel === "Delete collection" && collection ? (
          <>
            <p className="collection-confirm-copy">
              The items in this collection will remained saved.
              <br />
              This action can’t be undone.
            </p>
            <div className="sheet-actions">
              <button className="pill" onClick={() => setPanel("")}>
                Cancel
              </button>
              <button
                className="primary collection-delete"
                onClick={() => {
                  flow.close(() => {
                    state.deleteCollection(collection.id);
                    navigate(null);
                  });
                }}
              >
                Delete
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="sheet-copy">
              Sharing and invitations are not connected. This collection exists
              only in your local reference session; no invitation can be sent
              and no public link is available.
            </p>
            <button
              className="primary form-submit"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `Local reference collection: ${collection?.name ?? "Collection"}`,
                  );
                  setNotice(
                    "Collection name copied. Sharing is not connected.",
                  );
                } catch {
                  setNotice("Clipboard unavailable. Sharing is not connected.");
                }
                setPanel("");
              }}
            >
              Copy collection name
            </button>
          </>
        )}
      </Sheet>
      {notice && (
        <button
          className="local-toast"
          title="Local reference preview only; no remote account was changed"
          onClick={() => setNotice("")}
          role="status"
        >
          {notice}
        </button>
      )}
    </ShopSurface>
  );
}

export { Following } from "./following";
