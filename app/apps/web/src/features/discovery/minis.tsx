"use client";
import { ShopSurface } from "./hydration-boundary";
/* eslint-disable @next/next/no-img-element */
import { useRouter, useSearchParams } from "next/navigation";
import {
  miniCatalog,
  featuredMiniIds,
  findMini,
  liveFeaturedMiniIds,
  liveMiniGroups,
  miniIcon,
  miniPresentation,
  liveMiniInformation,
} from "./mini-model";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import type { Catalog } from "../catalog/types";
import { FloatingNav, IconButton, ProductCard, Sheet } from "./components";
import { Icon } from "./icons";
import { useDiscovery } from "./state";
import { MiniAccess, MiniShell, NativeMiniPhotoAccess } from "./mini-frame";
import {
  bindSourceDestination,
  rememberSourcePosition,
  restoreSourcePosition,
  SourceLink,
} from "./return-navigation";
import styles from "./minis.module.css";
import "./live-minis.css";
import { useMiniRoute } from "./mini-navigation";
export { Sol } from "./sol";
export function Minis({ android = false }: { android?: boolean }) {
  const minis = (android ? liveFeaturedMiniIds : featuredMiniIds).map((id) => ({
    id,
    ...miniCatalog[id],
  }));
  const state = useDiscovery();
  const params = useSearchParams();
  const router = useRouter();
  const { change } = useMiniRoute("/minis");
  const nativeSearch = android && params.get("search") === "1";
  const nativeQuery = params.get("q") ?? "";
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const searchOrigin = useRef<string | null>(null);
  const cancelNativeSearch = () => {
    if (searchOrigin.current) router.back();
    else change({ search: null, q: null }, true);
  };
  const wasNativeSearch = useRef(false);
  const editNativeQuery = (q: string | null) =>
    change({ q }, true, { nativeMiniSearchOrigin: searchOrigin.current });
  useLayoutEffect(() => {
    if (nativeSearch) {
      wasNativeSearch.current = true;
      const origin = window.history.state?.nativeMiniSearchOrigin;
      if (typeof origin === "string") searchOrigin.current = origin;
      document
        .getElementById("native-mini-search")
        ?.focus({ preventScroll: true });
    } else if (wasNativeSearch.current) {
      wasNativeSearch.current = false;
      if (searchOrigin.current)
        restoreSourcePosition('button[aria-label="Search Minis"]');
      else
        document
          .querySelector<HTMLButtonElement>('button[aria-label="Search Minis"]')
          ?.focus({ preventScroll: true });
    }
  }, [nativeSearch]);
  const [unavailable, setUnavailable] = useState(() => {
    const mini = findMini(params.get("notice") ?? "");
    return mini && !mini.available ? mini.name : "";
  });
  const snapItems = [
    {
      id: "sol",
      name: "Sol: Browse by Voice",
      description: "Your AI shopping companion you can talk to.",
    },
    {
      id: "room",
      name: "Get that room",
      description: "Snap your inspiration, and discover items direc…",
    },
    {
      id: "color",
      name: "Infinite Color Search",
      description: "Shop your favorite color. Powered by Hoppn.",
    },
  ];
  const fragment = (media: string, label: string) => (
    <button
      key={media}
      aria-label={label}
      onClick={() => setUnavailable("Mini details unavailable")}
    >
      <img src={`/api/reference-media/${media}`} alt="" />
    </button>
  );
  const row = (m: { id: string; name: string; description: string }) => {
    const content = (
      <>
        <img src={miniIcon(m.id, android)} alt="" />
        <span>
          <strong>{m.name}</strong>
          <p>{m.description}</p>
        </span>
      </>
    );
    return findMini(m.id)?.available ? (
      <SourceLink
        key={m.id}
        href={`/minis/${m.id}`}
        onClick={(event) => {
          state.visitMini(m.id);
          // Sheet consumes this navigation before Link's onNavigate. Its
          // stable page opener was recorded before the temporary entry.
          if (searching && event.defaultPrevented && searchOrigin.current)
            bindSourceDestination(searchOrigin.current, `/minis/${m.id}`);
        }}
      >
        {content}
      </SourceLink>
    ) : (
      <button
        key={m.id}
        onClick={() => {
          state.visitMini(m.id);
          setUnavailable(m.name);
        }}
      >
        {content}
      </button>
    );
  };
  const normalizedQuery = nativeQuery.trim().toLowerCase();
  const nativeResults = (
    normalizedQuery ? Object.keys(miniCatalog) : state.visitedMinis
  )
    .flatMap((id) => {
      const mini = miniPresentation(id, true);
      return mini ? [{ id, ...mini }] : [];
    })
    .filter(
      (mini) =>
        !normalizedQuery ||
        (mini.name + " " + mini.description)
          .toLowerCase()
          .includes(normalizedQuery),
    );
  if (normalizedQuery) {
    const rank = (name: string) =>
      name.toLowerCase().startsWith(normalizedQuery)
        ? 0
        : name.toLowerCase().includes(normalizedQuery)
          ? 1
          : 2;
    nativeResults.sort((a, b) => rank(a.name) - rank(b.name));
  }
  return (
    <ShopSurface
      className={`shop-page minis-page ${styles.catalog} ${android ? "android-live android-minis" : ""}`}
      data-searching={nativeSearch || undefined}
    >
      {nativeSearch ? (
        <>
          <header className="native-mini-searchbar">
            <label>
              <Icon name="search" />
              <input
                id="native-mini-search"
                type="search"
                aria-label="Search Minis"
                placeholder="Search"
                value={nativeQuery}
                onChange={(event) =>
                  editNativeQuery(event.target.value || null)
                }
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    cancelNativeSearch();
                  }
                }}
              />
              {nativeQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    editNativeQuery(null);
                    document.getElementById("native-mini-search")?.focus();
                  }}
                >
                  <Icon name="close" />
                </button>
              )}
            </label>
            <button type="button" onClick={cancelNativeSearch}>
              Cancel
            </button>
          </header>
          {!normalizedQuery && nativeResults.length > 0 && (
            <h2>Recently viewed</h2>
          )}
          <div className="mini-list native-mini-search-results">
            {nativeResults.map(row)}
          </div>
        </>
      ) : (
        <>
          <header className="section-heading">
            <h1>Minis</h1>
            <IconButton
              icon="search"
              label="Search Minis"
              onClick={() => {
                searchOrigin.current = rememberSourcePosition(
                  'button[aria-label="Search Minis"]',
                );
                if (android)
                  change({ search: "1", q: null }, false, {
                    nativeMiniSearchOrigin: searchOrigin.current,
                  });
                else setSearching(true);
              }}
            />
          </header>
          <div
            className="mini-carousel"
            aria-label="Featured Minis"
            tabIndex={0}
          >
            {minis.map((m) => (
              <SourceLink
                className="mini-feature"
                key={m.id}
                data-mini-id={m.id}
                href={`/minis/${m.id}`}
                onClick={() => state.visitMini(m.id)}
              >
                <img
                  src={`/api/reference-media/${android ? "live-mini" : "mini"}-${m.id}-hero`}
                  alt=""
                />
                <div>
                  <img src={miniIcon(m.id, android)} alt="" />
                  <span>
                    <strong>{m.name}</strong>
                    <p>{m.description}</p>
                  </span>
                </div>
              </SourceLink>
            ))}
          </div>
          {state.visitedMinis.length > 0 && (
            <>
              <h2>Recently viewed</h2>
              <div className="mini-recent">
                {state.visitedMinis.map((id) => {
                  const mini = findMini(id);
                  if (!mini) return null;
                  const icon = <img src={miniIcon(id, android)} alt="" />;
                  return mini.available ? (
                    <SourceLink
                      key={id}
                      href={`/minis/${id}`}
                      aria-label={mini.name}
                      onClick={() => state.visitMini(id)}
                    >
                      {icon}
                    </SourceLink>
                  ) : (
                    <button
                      key={id}
                      type="button"
                      aria-label={mini.name}
                      onClick={() => {
                        state.visitMini(id);
                        setUnavailable(mini.name);
                      }}
                    >
                      {icon}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          {android ? (
            liveMiniGroups.map((group) => (
              <section className="native-mini-group" key={group.title}>
                <h2>{group.title}</h2>
                <div
                  className="mini-list-pages"
                  aria-label={group.title}
                  tabIndex={0}
                >
                  {group.pages.map((ids, index) => (
                    <div className="mini-list" key={index}>
                      {ids.map((id) => {
                        const mini = miniPresentation(id, true);
                        return mini ? row({ id, ...mini }) : null;
                      })}
                    </div>
                  ))}
                </div>
              </section>
            ))
          ) : (
            <>
              <h2>Snap & Shop</h2>
              <div className="mini-list-pages">
                <div className="mini-list">{snapItems.map(row)}</div>
                <div
                  className={`mini-list ${styles.catalogFragments}`}
                  aria-label="Captured Snap and Shop continuation"
                >
                  {fragment(
                    "minis-snap-gem-icon-fragment",
                    "Additional Snap and Shop Mini 1",
                  )}
                  {fragment(
                    "minis-snap-cat-icon-fragment",
                    "Additional Snap and Shop Mini 2",
                  )}
                  <SourceLink
                    href="/minis/look"
                    aria-label="Get the Look"
                    onClick={() => state.visitMini("look")}
                  >
                    <img src="/api/reference-media/mini-look-icon" alt="" />
                  </SourceLink>
                </div>
              </div>
              <h2>Design Your Space</h2>
              <div className="mini-list-pages">
                <div className="mini-list">
                  {row({
                    id: "decor",
                    name: "Help Me Decor",
                    description:
                      "AI-powered interior styling Shop Mini that help…",
                  })}
                  <button
                    onClick={() => {
                      state.visitMini("homescape");
                      setUnavailable("Homescape AI");
                    }}
                  >
                    <img
                      src="/api/reference-media/mini-homescape-icon"
                      alt=""
                    />
                    <span>
                      <strong>Homescape AI</strong>
                      <p>Home décor ideas with arts, plants & renovation</p>
                    </span>
                  </button>
                </div>
                <div
                  className={`mini-list ${styles.catalogFragments}`}
                  aria-label="Captured Design Your Space continuation"
                >
                  {fragment(
                    "minis-space-script-icon-fragment",
                    "Additional Design Your Space Mini 1",
                  )}
                  {fragment(
                    "minis-space-room-icon-fragment",
                    "Additional Design Your Space Mini 2",
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
      <Sheet
        open={searching}
        title="Search Minis"
        initialFocus="#mini-search"
        onClose={() => setSearching(false)}
      >
        <input
          id="mini-search"
          className="mini-search"
          aria-label="Search Minis"
          placeholder="Search Minis"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="mini-list">
          {minis
            .filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
            .map(row)}
        </div>
      </Sheet>
      <Sheet
        open={!!unavailable}
        title={unavailable}
        onClose={() => setUnavailable("")}
      >
        <p className="sheet-copy">
          This Mini has no captured detail flow and is unavailable in this
          reference preview.
        </p>
      </Sheet>
      <FloatingNav android={android} back fade />
    </ShopSurface>
  );
}
export { useMiniRoute } from "./mini-navigation";

export function LocalPhotoPicker({
  open,
  onClose,
  title,
  anchorSelector,
  outfit = false,
  referenceExamples = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  anchorSelector: string;
  outfit?: boolean;
  referenceExamples?: boolean;
}) {
  const [localImage, setLocalImage] = useState("");
  const [error, setError] = useState("");
  const currentImage = useRef("");
  const contents = useRef<HTMLDivElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const noteId = useId();
  const clearImage = () => {
    if (currentImage.current) URL.revokeObjectURL(currentImage.current);
    currentImage.current = "";
    setLocalImage("");
    setError("");
  };
  const close = () => {
    clearImage();
    onClose();
  };
  const selected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    if (currentImage.current) URL.revokeObjectURL(currentImage.current);
    const url = URL.createObjectURL(file);
    currentImage.current = url;
    setError("");
    setLocalImage(url);
  };
  useEffect(
    () => () => {
      if (currentImage.current) URL.revokeObjectURL(currentImage.current);
    },
    [],
  );
  useLayoutEffect(() => {
    if (!open) return;
    if (localImage) {
      contents.current
        ?.querySelector<HTMLButtonElement>("[data-local-photo-done]")
        ?.focus({ preventScroll: true });
      return;
    }
    const place = () => {
      const anchor = document.querySelector(anchorSelector);
      const dialog = contents.current?.closest("dialog");
      if (!anchor || !dialog) return;
      const rect = anchor.getBoundingClientRect();
      const width = Math.min(250, window.innerWidth - 24);
      const left = Math.max(
        12,
        Math.min(
          window.innerWidth - width - 12,
          rect.left + rect.width / 2 + (outfit ? 16 : 0) - width / 2,
        ),
      );
      const top = Math.max(
        12,
        Math.min(
          window.innerHeight - 158,
          rect.bottom - 146 + (outfit ? -17 : 1),
        ),
      );
      dialog.style.setProperty("--photo-menu-left", `${left}px`);
      dialog.style.setProperty("--photo-menu-top", `${top}px`);
    };
    place();
    contents.current
      ?.querySelector<HTMLButtonElement>("[data-photo-option]")
      ?.focus({ preventScroll: true });
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { passive: true });
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place);
    };
  }, [open, localImage, anchorSelector, outfit]);
  return (
    <Sheet
      open={open}
      title={localImage ? "Photo preview" : title}
      onClose={close}
      headerless={!localImage}
      className={
        localImage
          ? styles.localPhotoPicker
          : `${styles.photoPicker} ${outfit ? styles.outfitPhotoPicker : ""}`
      }
    >
      <div ref={contents}>
        {localImage ? (
          <div className={styles.localPhoto}>
            <img
              src={localImage}
              alt="Selected local image"
              onError={() =>
                setError(
                  "This image could not be opened. Choose another photo.",
                )
              }
            />
            <p role="status">
              Image selected locally. Image recognition is not connected. No
              photo is uploaded or analyzed.
            </p>
            <button className="muted-button" onClick={clearImage}>
              Choose another photo
            </button>
            <button className="primary" data-local-photo-done onClick={close}>
              Done
            </button>
          </div>
        ) : (
          <>
            <p id={noteId} className="sr-only">
              No photo is uploaded or analyzed.
              {referenceExamples &&
                " Captured examples are available in the Mini preview controls."}
            </p>
            <button
              type="button"
              className={styles.photoOption}
              data-photo-option
              aria-describedby={noteId}
              onClick={() => libraryInput.current?.click()}
            >
              <Icon name="photo-library" />
              Photo Library
            </button>
            <button
              type="button"
              className={styles.photoOption}
              aria-describedby={noteId}
              onClick={() => cameraInput.current?.click()}
            >
              <Icon name="camera" />
              Take Photo
            </button>
            <button
              type="button"
              className={styles.photoOption}
              aria-describedby={noteId}
              onClick={() => fileInput.current?.click()}
            >
              <svg
                aria-hidden="true"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              >
                <path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v11H3Z" />
                <path d="M3 9h18" />
              </svg>
              Choose File
            </button>
            <input
              hidden
              ref={libraryInput}
              type="file"
              accept="image/*"
              aria-label="Choose image from photo library"
              onChange={selected}
            />
            <input
              hidden
              ref={cameraInput}
              type="file"
              accept="image/*"
              capture="user"
              aria-label="Take a local photo"
              onChange={selected}
            />
            <input
              hidden
              ref={fileInput}
              type="file"
              accept="image/*"
              aria-label="Choose local image"
              onChange={selected}
            />
          </>
        )}
        {error && (
          <p className={styles.photoError} role="alert">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}

const skinResultMedia: Record<string, string> = {
  "skin-anua": "skin-card-anua",
  "skin-mimi": "skin-card-mimi",
  "skin-loretta": "skin-card-loretta",
  "skin-harry": "skin-card-harry",
};

export function Skin({ catalog }: { catalog: Catalog }) {
  const router = useRouter();
  const { params, change } = useMiniRoute("/minis/skin");
  const requested = params.get("skin");
  const phase =
    requested === "analyzing" || requested === "results"
      ? requested
      : "welcome";
  const [upload, setUpload] = useState(false);
  const [cameraAccess, setCameraAccess] = useState(false);
  const [menu, setMenu] = useState(false);
  const [unavailableProduct, setUnavailableProduct] = useState("");
  useEffect(() => {
    if (phase !== "analyzing") return;
    const timer = window.setTimeout(
      () => change({ skin: "results" }, true),
      2400,
    );
    return () => window.clearTimeout(timer);
  }, [phase, change]);
  const reset = () => {
    change({ skin: null });
    window.scrollTo(0, 0);
  };
  return (
    <MiniShell
      name="Skincare AI"
      className={styles.shell}
      showBack={phase === "results"}
      onBack={() => router.back()}
      onMenu={() => setMenu(true)}
      menuLabel="Skincare AI preview controls"
    >
      <section
        className={`skin-surface ${styles.skin} ${cameraAccess ? styles.skinPermissionOpen : ""} ${phase === "results" ? `skin-results ${styles.skinResults}` : ""}`}
        data-skin-phase={phase}
        data-camera-permission={cameraAccess || undefined}
      >
        {phase !== "results" ? (
          <>
            <div className="skin-heading">
              <img src="/api/reference-media/skin-symbol" alt="" />
              <h1>
                AI Powered
                <br />
                Skincare
              </h1>
            </div>
            <button
              className="skin-analyze"
              disabled={phase === "analyzing"}
              onClick={() => setCameraAccess(true)}
            >
              <Icon name={phase === "analyzing" ? "star" : "camera"} />
              {phase === "analyzing" ? "AI is analyzing..." : "Analyze My Skin"}
            </button>
            <p role={phase === "analyzing" ? "status" : undefined}>
              {phase === "analyzing" ? (
                "Please wait, this may take a moment..."
              ) : (
                <>
                  Please upload a clear photo of your
                  <br />
                  face to get better results.
                </>
              )}
            </p>
            <small>
              AI may make mistakes. Please review
              <br />
              recommendations carefully.
            </small>
          </>
        ) : (
          <>
            <div className={styles.skinResultHeading}>
              <h1>
                <img src="/api/reference-media/skin-symbol" alt="" />
                Skincare AI
              </h1>
              <small>Powered by Coalition Technologies</small>
            </div>
            <p className={styles.previewLabel}>
              Recorded example · no skin analysis performed
            </p>
            <section className="skin-summary">
              <h2>
                <Icon name="face-scan" />
                Overall Skin Summary
              </h2>
              <p>
                Your skin appears well-hydrated, smooth, and radiant with an
                even tone, indicating excellent overall health.
              </p>
            </section>
            <section className="skin-summary">
              <h2>
                <Icon name="shopping-bag" />
                Recommended Products
              </h2>
              <p>
                To maintain your beautiful skin, we recommend a gentle hydrating
                cleanser, a vitamin C serum for brightness, and a daily
                moisturizer with SPF 30. For nightly care, a simple hydrating
                moisturizer is sufficient.
              </p>
            </section>
            <h2 className={styles.cleanserHeading}>Cleanser</h2>
            <div className="product-grid">
              {["skin-anua", "skin-mimi", "skin-loretta", "skin-harry"].flatMap(
                (id) => {
                  const product = catalog.products.find(
                    (item) => item.id === id,
                  );
                  return product
                    ? [
                        <ProductCard
                          key={id}
                          ratingStars={4.5}
                          product={{
                            ...product,
                            images: [
                              `/api/reference-media/${skinResultMedia[id]}`,
                            ],
                          }}
                        />,
                      ]
                    : [];
                },
              )}
            </div>
            <div className="product-grid skin-partial-grid">
              {[
                [
                  "skin-card-laundry-partial",
                  "Skin Laundry Hydrating Gentle Cleanser",
                ],
                ["skin-card-gopure-partial", "goPure Gentle Gel Cleanser"],
              ].map(([key, title]) => (
                <div key={key} className={styles.skinPartialCard}>
                  <button
                    className={styles.skinPartialPhoto}
                    aria-label={`View ${title}`}
                    onClick={() => setUnavailableProduct(title)}
                  >
                    <img src={`/api/reference-media/${key}`} alt="" />
                  </button>
                  <IconButton
                    icon="heart"
                    label={`Save ${title}`}
                    className="save-button"
                    onClick={() => setUnavailableProduct(title)}
                  />
                </div>
              ))}
            </div>
            <button
              className={styles.skinHome}
              aria-label="Start skin example again"
              onClick={reset}
            >
              <Icon name="home" />
            </button>
          </>
        )}
      </section>
      <Sheet
        open={cameraAccess}
        title="Allow access to your camera?"
        headerless
        className={styles.permission}
        onClose={() => setCameraAccess(false)}
      >
        <div className={styles.permissionHeading}>
          <h2 aria-hidden="true">Allow access to your camera?</h2>
          <span className={styles.permissionMark} aria-hidden="true">
            <img
              className={styles.permissionIcon}
              src="/api/reference-media/mini-skin-icon"
              alt=""
            />
            <img
              className={styles.permissionAvatar}
              src="/api/reference-media/skin-permission-avatar"
              alt=""
            />
          </span>
        </div>
        <p>
          No camera access is requested. Choose a photo locally or use your
          device picker.
        </p>
        <div className={styles.permissionActions}>
          <button onClick={() => setCameraAccess(false)}>Cancel</button>
          <button
            onClick={() => {
              setCameraAccess(false);
              setUpload(true);
            }}
          >
            Share
          </button>
        </div>
      </Sheet>
      <LocalPhotoPicker
        open={upload}
        title="Choose a photo"
        anchorSelector=".skin-analyze"
        onClose={() => setUpload(false)}
      />
      <Sheet
        open={!!unavailableProduct}
        title="Product details unavailable"
        onClose={() => setUnavailableProduct("")}
      >
        <p className="sheet-copy">
          {unavailableProduct} appears in the captured example. Complete product
          details are unavailable, so it has not been opened, saved, or added to
          a cart.
        </p>
      </Sheet>
      <Sheet
        open={menu}
        title="Skincare AI preview"
        onClose={() => setMenu(false)}
      >
        <button
          className="account-row"
          onClick={() => {
            setMenu(false);
            change({ skin: "analyzing" });
          }}
        >
          <Icon name="photo-library" />
          View reference example
        </button>
        <p className="sheet-copy">
          This is a recorded Shop reference example. Skin analysis is not
          connected; the captured advice is not an assessment of your skin.
          Photos selected with your device picker stay on this device.
        </p>
        <button
          className="account-row"
          onClick={() => {
            setMenu(false);
            reset();
          }}
        >
          Start again
        </button>
      </Sheet>
    </MiniShell>
  );
}

const outfitPieces = [
  {
    id: "blazer",
    label: "Women’s White Linen Blazer",
    products: ["look-sculpt", "look-aven"],
    boundedMedia: "look-blazer-third-partial",
    top: "42.2%",
    left: "-6.6%",
    pointAtEnd: true,
  },
  {
    id: "shirt",
    label: "Women’s Black Crew Neck T-shirt",
    products: ["look-black-crew", "look-white-crew"],
    boundedMedia: "look-shirt-third-partial",
    top: "34.2%",
    left: "43.5%",
    pointAtEnd: false,
  },
  {
    id: "skirt",
    label: "Women’s Black and White Gingham Mini Skirt",
    products: [],
    boundedMedia: "look-skirt-three-partial",
    top: "51.3%",
    left: "42.6%",
    pointAtEnd: false,
  },
  {
    id: "sandals",
    label: "Women’s Gold Embellished Sandals",
    products: [],
    top: "77.8%",
    left: "45.8%",
    pointAtEnd: false,
  },
] as const;

const lookProductMedia: Partial<Record<string, string>> = {
  "look-sculpt": "look-blazer-one-card",
  "look-aven": "look-blazer-two-card",
  "look-black-crew": "look-shirt-one-card",
  "look-white-crew": "look-shirt-two-card",
};

const boundedContinuationCopy: Partial<
  Record<(typeof outfitPieces)[number]["id"], { title: string; price: string }>
> = {
  blazer: { title: "White", price: "$27" },
  shirt: { title: "Women’s", price: "$90" },
};

export function GetLook({ catalog }: { catalog: Catalog }) {
  const android = Boolean(catalog.liveHomeStoreIds);
  const [photoAccess, setPhotoAccess] = useState(false);
  const { params, change } = useMiniRoute("/minis/look");
  const requested = params.get("look");
  const phase =
    !android && (requested === "scanning" || requested === "results")
      ? requested
      : "welcome";
  const selected = outfitPieces.find(
    (piece) => piece.id === params.get("piece"),
  );
  const [choose, setChoose] = useState(false);
  const matching = outfitPieces.find(
    (piece) => piece.id === params.get("matches"),
  );
  const allMatchesButton = useRef<HTMLButtonElement>(null);
  const choosePhotoButton = useRef<HTMLButtonElement>(null);
  const viewedAllMatches = useRef(false);
  useEffect(() => {
    if (phase !== "results") return;
    if (selected) {
      if (viewedAllMatches.current)
        allMatchesButton.current?.focus({ preventScroll: true });
      viewedAllMatches.current = false;
      return;
    }
    if (!matching) return;
    viewedAllMatches.current = true;
    const frame = requestAnimationFrame(() => {
      const target =
        document.getElementById("look-blazer") ??
        document.querySelector(".look-results");
      target?.scrollIntoView({ block: "start" });
      target?.querySelector("h2")?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [phase, selected, matching]);
  const [terms, setTerms] = useState(() => !android && phase === "welcome");
  const [menu, setMenu] = useState(false);
  const [information, setInformation] = useState("");
  useEffect(() => {
    if (phase !== "scanning") return;
    const timer = window.setTimeout(
      () => change({ look: "results" }, true),
      2400,
    );
    return () => window.clearTimeout(timer);
  }, [phase, change]);
  const reset = () => {
    change({ look: null, piece: null, matches: null });
    window.scrollTo(0, 0);
  };
  function results(piece: (typeof outfitPieces)[number]) {
    if (piece.id === "sandals")
      return (
        <p className={styles.missingProducts}>
          The recording identifies sandals but does not include their product
          recommendations.
        </p>
      );
    return (
      <div
        className={`product-rail ${piece.id === "skirt" ? "look-partial-rail" : ""}`}
      >
        {piece.products.flatMap((id) => {
          const product = catalog.products.find((item) => item.id === id);
          const media = lookProductMedia[id];
          return product
            ? [
                <ProductCard
                  key={id}
                  product={
                    media
                      ? {
                          ...product,
                          images: [`/api/reference-media/${media}`],
                        }
                      : product
                  }
                  showPromotion
                />,
              ]
            : [];
        })}
        {piece.id === "skirt" &&
          ["look-skirt-one-partial", "look-skirt-two-partial"].map((key) => (
            <div className="look-partial-card" key={key}>
              <img
                src={`/api/reference-media/${key}`}
                alt="Captured gingham skirt recommendation"
              />
            </div>
          ))}
        <div
          className={`${styles.lookBoundedCard} ${piece.id === "skirt" ? styles.lookBoundedCardShort : ""}`}
          data-look-source-boundary={piece.id}
          aria-hidden="true"
        >
          <img src={`/api/reference-media/${piece.boundedMedia}`} alt="" />
          {piece.id !== "skirt" && boundedContinuationCopy[piece.id] && (
            <span className={styles.lookBoundedCopy}>
              <strong>{boundedContinuationCopy[piece.id]?.title}</strong>
              <span>{boundedContinuationCopy[piece.id]?.price}</span>
            </span>
          )}
        </div>
      </div>
    );
  }
  return (
    <MiniShell
      name="Get the Look"
      nativeInfo={android ? liveMiniInformation.look : undefined}
      className={styles.shell}
      showBack={false}
      onMenu={() => setMenu(true)}
      menuLabel="Get the Look preview controls"
    >
      <section
        className={`look-surface ${styles.look}${android ? " live-look" : ""}`}
        data-look-phase={phase}
        data-look-terms={terms}
        data-look-piece={selected?.id ?? ""}
        data-look-match={Boolean(matching && !selected)}
      >
        {phase === "results" && (
          <button
            className={styles.lookBack}
            aria-label="Choose another outfit photo"
            onClick={reset}
          >
            <Icon name="back" />
          </button>
        )}
        <div className="look-wordmark">
          <img src="/api/reference-media/look-wordmark" alt="Get the Look" />
        </div>
        {phase === "welcome" ? (
          <>
            <h1>
              Find every piece
              <br />
              from any outfit
            </h1>
            <p>
              Upload an outfit photo and discover
              <br />
              matching pieces from Shopify stores
            </p>
            <button
              ref={choosePhotoButton}
              className="look-upload"
              onClick={() => {
                setTerms(false);
                if (android) setPhotoAccess(true);
                else setChoose(true);
              }}
            >
              <Icon name="camera" />
              Choose Photo
            </button>
          </>
        ) : phase === "scanning" ? (
          <>
            <div className="look-photo">
              <img
                src="/api/reference-media/look-outfit-inner"
                alt="Captured outfit"
              />
            </div>
            <p role="status">Scanning outfit...</p>
            <button
              className={styles.playback}
              onClick={() => change({ look: "results" }, true)}
            >
              View captured matches
            </button>
          </>
        ) : (
          <>
            <div className="look-photo">
              <img
                src="/api/reference-media/look-outfit-results"
                alt="Reference outfit: white blazer, black shirt and patterned skirt"
              />
              {selected?.id === "shirt" && (
                <span
                  className={styles.selectedShirtOutline}
                  aria-hidden="true"
                />
              )}
              {outfitPieces.map((piece) => (
                <button
                  key={piece.id}
                  style={{ top: piece.top, left: piece.left }}
                  className={piece.pointAtEnd ? styles.pointAtEnd : ""}
                  aria-label={piece.label}
                  aria-pressed={selected?.id === piece.id}
                  onClick={() =>
                    change({
                      piece: selected?.id === piece.id ? null : piece.id,
                      matches: null,
                    })
                  }
                >
                  <span className={styles.hotspot} />
                  <span>{piece.label}</span>
                </button>
              ))}
            </div>
            <div className="look-results">
              {selected && (
                <section
                  className={styles.selectedOutfit}
                  aria-label="Selected outfit piece"
                >
                  <small>Selected</small>
                  <h2>{selected.label}</h2>
                  {results(selected)}
                  <button
                    ref={allMatchesButton}
                    className={styles.allMatches}
                    onClick={() => {
                      change({ piece: null, matches: selected.id });
                    }}
                  >
                    View all matching pieces
                  </button>
                </section>
              )}
              {outfitPieces
                .filter((piece) => piece.id !== "sandals")
                .map((piece) => (
                  <section key={piece.id} id={`look-${piece.id}`}>
                    <h2 tabIndex={-1}>{piece.label}</h2>
                    {results(piece)}
                  </section>
                ))}
            </div>
            <button className={styles.playback} onClick={reset}>
              Choose another photo
            </button>
          </>
        )}
        {terms && phase === "welcome" && (
          <aside
            className={styles.termsNotice}
            aria-label="Get the Look terms notice"
          >
            <p>
              By continuing to use this Mini, you agree to the{" "}
              <button onClick={() => setInformation("Terms")}>terms</button> and{" "}
              <button onClick={() => setInformation("Privacy policy")}>
                privacy policy
              </button>{" "}
              of Lit Dog Labs.
            </p>
            <button
              aria-label="Dismiss Get the Look terms notice"
              onClick={() => {
                setTerms(false);
                choosePhotoButton.current?.focus({ preventScroll: true });
              }}
            >
              <Icon name="close" />
            </button>
          </aside>
        )}
      </section>
      <NativeMiniPhotoAccess
        open={photoAccess}
        onClose={() => setPhotoAccess(false)}
        onContinue={() => {
          setPhotoAccess(false);
          setChoose(true);
        }}
        icon={miniIcon("look", true)}
      />
      <LocalPhotoPicker
        open={choose}
        title="Choose Photo"
        anchorSelector=".look-upload"
        referenceExamples={!android}
        outfit
        onClose={() => setChoose(false)}
      />
      <Sheet
        open={menu}
        title="Get the Look preview"
        onClose={() => setMenu(false)}
      >
        <button
          className="account-row"
          onClick={() => {
            setMenu(false);
            setTerms(false);
            change({ look: "scanning", piece: null, matches: null });
          }}
        >
          <Icon name="photo-library" />
          Use reference outfit
        </button>
        <p className="sheet-copy">
          This is a recorded outfit example. Image recognition is not connected.
          Hotspots select the recorded pieces; a local file remains on this
          device.
        </p>
        <button
          className="account-row"
          onClick={() => {
            setMenu(false);
            reset();
          }}
        >
          Choose another photo
        </button>
      </Sheet>
      <Sheet
        open={!!information}
        title={information}
        onClose={() => setInformation("")}
      >
        <p className="sheet-copy">
          The captured Get the Look Mini was provided by Lit Dog Labs. Its
          external terms and privacy services are not connected in this local
          preview.
        </p>
      </Sheet>
    </MiniShell>
  );
}

const traits = [
  "Adventurous",
  "Creative",
  "Thoughtful",
  "Practical",
  "Stylish",
  "Tech-Savvy",
  "Outdoorsy",
  "Homebody",
  "Funny",
  "Outgoing",
];
const giftPhases = [
  "welcome",
  "recipient",
  "personality",
  "budget",
  "notes",
  "results",
  "finding",
  "results-loading",
];
const giftGlyphs: Record<string, string> = {
  Adventurous: "m3 20 6-15 4 8 3-5 5 12H3ZM7 10l3 2 2-2",
  Creative:
    "M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 1-4c-2-1-1-3 1-3h2a3 3 0 0 0 3-3c0-5-4-8-9-8ZM7 9h.01M11 6h.01M16 8h.01M6 14h.01",
  Thoughtful: "M3 4h5l4 2 4-2h5v15h-5l-4 2-4-2H3V4Zm9 2v15",
  Practical:
    "M14 3a6 6 0 0 0-7 7L2 17a3 3 0 0 0 5 5l7-8a6 6 0 0 0 7-7l-5 5-4-4 4-5Z",
  Stylish: "m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4a4 4 0 0 1-8 0Z",
  "Tech-Savvy": "M5 4h14v13H5V4Zm-2 13h18l1 4H2l1-4Z",
  Outdoorsy: "m12 2 5 7h-3l5 7h-5v6h-4v-6H5l5-7H7l5-7Z",
  Homebody: "M3 10 12 3l9 7v11H3V10Zm6 11V12h6v9",
  Funny:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM8 14s1 3 4 3 4-3 4-3M8 9h.01M16 9h.01",
  Outgoing: "M21 11a9 9 0 0 1-9 9l-8 2 1-6a9 9 0 1 1 16-5Z",
  Partner: "M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8 6l8 9 8-9a5 5 0 0 0 0-7Z",
  Family:
    "M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-2a7 7 0 0 1 14 0v2M16 4a4 4 0 0 1 0 8m3 2a7 7 0 0 1 3 7",
  Friend:
    "m2 6 5-3 5 3 5-3 5 3-3 12-5 3-8-5L2 6Zm5-3 3 8 4 2 2-3m-9 4 7 7M16 6l-4 5",
  Colleague: "M3 7h18v14H3V7Zm5 0V3h8v4M8 7v14m8-14v14",
  Child:
    "M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM12 4s4 3 0 5M8 12h.01M16 12h.01M8 16s4 3 8 0",
  "Under $25": "M12 2v20M18 6H9a4 4 0 0 0 0 8h6a4 4 0 0 1 0 8H6",
  "Under $50":
    "M15 8a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-6-3v6m-2-5h3m-7 2h3m11 2a6 6 0 1 1-7 8",
  "Under $100":
    "M2 6h20v12H2V6Zm12 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM5 12h.01M19 12h.01",
  "Under $200": "m3 8 4-5h10l4 5-9 13L3 8Zm0 0h18M7 3l5 18 5-18",
  "$200+": "m2 5 6 5 4-7 4 7 6-5-3 14H5L2 5Zm3 14v3h14v-3",
  "Any Budget": "m12 2 2 7 7 3-7 2-2 8-2-8-8-2 8-3 2-7Zm8-1v5m-2-2h5",
};
function GiftGlyph({ label }: { label: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={giftGlyphs[label] ?? giftGlyphs["Any Budget"]} />
    </svg>
  );
}
type GiftAnswers = {
  recipient: string;
  selected: string[];
  budget: string;
  notes: string;
  drafts: Record<string, string>;
  collectionId: string;
};
const emptyGiftAnswers: GiftAnswers = {
  recipient: "",
  selected: [],
  budget: "",
  notes: "",
  drafts: {},
  collectionId: "",
};

function readGiftAnswers(historyState: unknown): GiftAnswers | undefined {
  if (!historyState || typeof historyState !== "object") return;
  const value = (historyState as { giftAnswers?: unknown }).giftAnswers;
  if (!value || typeof value !== "object") return;
  const answer = value as Partial<GiftAnswers>;
  if (
    typeof answer.recipient !== "string" ||
    typeof answer.budget !== "string" ||
    typeof answer.notes !== "string" ||
    !Array.isArray(answer.selected) ||
    !answer.selected.every((item) => typeof item === "string") ||
    !answer.drafts ||
    typeof answer.drafts !== "object" ||
    !Object.values(answer.drafts).every((draft) => typeof draft === "string")
  )
    return;
  return {
    recipient: answer.recipient,
    selected: answer.selected,
    budget: answer.budget,
    notes: answer.notes,
    drafts: answer.drafts,
    collectionId:
      typeof answer.collectionId === "string" ? answer.collectionId : "",
  };
}

export function GiftSense({ catalog }: { catalog: Catalog }) {
  const state = useDiscovery();
  const { params, change } = useMiniRoute("/minis/gift");
  const phaseIndex = giftPhases.indexOf(params.get("gift") ?? "welcome");
  const loadingResults = phaseIndex === 7;
  const step = phaseIndex < 0 ? 0 : loadingResults ? 5 : phaseIndex;
  const [answers, setAnswers] = useState<GiftAnswers>(emptyGiftAnswers);
  const [access, setAccess] = useState(false);
  const [menu, setMenu] = useState(false);
  const [similar, setSimilar] = useState(false);
  const conversation = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLInputElement>(null);
  const products = ["gift-logic", "gift-buds", "gift-nirvana"].flatMap((id) => {
    const product = catalog.products.find((item) => item.id === id);
    return product ? [product] : [];
  });
  const { recipient, selected, budget, notes } = answers;
  const saved = state.collections.some(
    (collection) => collection.id === answers.collectionId,
  );
  const draft = answers.drafts[String(step)] ?? "";
  function remember(next: GiftAnswers) {
    setAnswers(next);
    window.history.replaceState(
      { ...window.history.state, giftAnswers: next },
      "",
      window.location.href,
    );
  }
  function advance(
    nextStep: number,
    update: Partial<GiftAnswers> = {},
    replace = false,
  ) {
    const next = { ...answers, ...update };
    remember(next);
    change({ gift: nextStep ? giftPhases[nextStep] : null }, replace, {
      giftAnswers: next,
    });
  }
  function restart() {
    remember(emptyGiftAnswers);
    change({ gift: null }, false, { giftAnswers: emptyGiftAnswers });
    setAccess(false);
    setMenu(false);
  }
  useEffect(() => {
    const restore = (historyState: unknown) => {
      setAnswers(readGiftAnswers(historyState) ?? emptyGiftAnswers);
    };
    // Restore the existing entry after hydration as well as on Back/Forward.
    // Reading window in the server-rendered initializer would mismatch reloads.
    restore(window.history.state);
    const onPopState = (event: PopStateEvent) => restore(event.state);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  useEffect(() => {
    if (step !== 6) return;
    const timer = window.setTimeout(
      () => change({ gift: "results-loading" }, true, { giftAnswers: answers }),
      2400,
    );
    return () => window.clearTimeout(timer);
  }, [step, change, answers]);
  useEffect(() => {
    if (!loadingResults) return;
    const timer = window.setTimeout(
      () => change({ gift: "results" }, true, { giftAnswers: answers }),
      2400,
    );
    return () => window.clearTimeout(timer);
  }, [loadingResults, change, answers]);
  // Match the captured conversation anchor before its permission sheet paints.
  useLayoutEffect(() => {
    const scroller = conversation.current;
    if (!scroller) return;
    if (step === 0 || step === 1) scroller.scrollTo({ top: 0 });
    else if (step === 5 || step === 6) {
      const tailOffset = step === 6 ? 32 : loadingResults ? 64 : 0;
      scroller.scrollTo({
        top: scroller.scrollHeight - scroller.clientHeight - tailOffset,
      });
    } else {
      const target = scroller.querySelector<HTMLElement>(
        `[data-gift-step="${step === 4 ? 3 : step}"]`,
      );
      if (target) {
        const adjustment = step === 4 ? 38 + (access ? 69 : 0) : 0;
        scroller.scrollTo({
          top: target.offsetTop - scroller.offsetTop + adjustment,
        });
      }
    }
    if (step === 4 && !access) composer.current?.focus({ preventScroll: true });
  }, [step, loadingResults, access, notes]);
  function requestIdeas() {
    const next = { ...answers, notes: draft.trim() };
    remember(next);
    setAccess(true);
  }
  const completed = step === 5 || step === 6;
  const progress = access
    ? 10
    : step === 0 || step === 1
      ? 0
      : step === 2
        ? 5
        : step === 3
          ? 7
          : step === 4
            ? 8
            : 10;
  const canType = step >= 1 && step <= 4;
  return (
    <MiniShell
      name="Gift Sense"
      className={styles.shell}
      showBack={false}
      onMenu={() => setMenu(true)}
      menuLabel="Gift Sense preview controls"
    >
      <section
        className={`gift-surface ${styles.gift}`}
        data-gift-phase={loadingResults ? "results-loading" : giftPhases[step]}
        data-gift-access={access ? "true" : undefined}
      >
        <div className="gift-progress">
          <Icon name="gift" />
          <div aria-label={`Gift questions ${progress} of 10`}>
            {Array.from({ length: 10 }, (_, i) => (
              <i key={i} className={i < progress ? "active" : ""} />
            ))}
          </div>
          <IconButton
            icon="reset"
            label="Restart gift questions"
            onClick={restart}
          />
        </div>
        <div className="gift-conversation" ref={conversation}>
          <div className={step > 0 ? "gift-history" : ""}>
            <div className={`gift-message ${styles.giftWelcome}`}>
              <p>
                Welcome to Gift Sense, your smart guide to finding gifts that
                truly fit.
              </p>
              <p>
                Tell us about the person, answer a few questions, and discover
                gifts tailored perfectly to who they are.
              </p>
            </div>
          </div>
          {step === 0 && (
            <button
              className={`gift-action ${styles.giftWelcomeAction}`}
              onClick={() => advance(1)}
            >
              Let’s Begin <Icon name="sparkles" />
            </button>
          )}
          {step >= 1 && (
            <>
              <section
                className={step > 1 ? "gift-history" : ""}
                data-gift-step="1"
              >
                <div className="gift-message">
                  Let’s start simple, who are you buying a gift for?
                </div>
                <p>
                  <em>Choose one or type your own.</em>
                </p>
                <div className="gift-options">
                  {["Partner", "Family", "Friend", "Colleague", "Child"].map(
                    (person) => (
                      <button
                        key={person}
                        disabled={step !== 1}
                        aria-pressed={recipient === person}
                        onClick={() => advance(2, { recipient: person })}
                      >
                        <GiftGlyph label={person} />
                        {person}
                      </button>
                    ),
                  )}
                </div>
              </section>
              {step >= 2 && (
                <section data-gift-step="2">
                  <div className="gift-answer">{recipient}</div>
                  <div className={step > 2 ? "gift-history" : ""}>
                    <div className="gift-message">
                      How would you describe their personality?
                    </div>
                    <p>
                      <em>Select all that sound like them.</em>
                    </p>
                    <div className="gift-options">
                      {traits.map((trait) => (
                        <button
                          key={trait}
                          disabled={step !== 2}
                          aria-pressed={selected.includes(trait)}
                          onClick={() =>
                            remember({
                              ...answers,
                              selected: selected.includes(trait)
                                ? selected.filter((value) => value !== trait)
                                : [...selected, trait],
                            })
                          }
                        >
                          <span className="radio-outline" />
                          <GiftGlyph label={trait} />
                          {trait}
                        </button>
                      ))}
                    </div>
                    {step === 2 && (
                      <button
                        className={`gift-action ${selected.length ? "" : styles.skip}`}
                        onClick={() => advance(3)}
                      >
                        {selected.length ? "Continue" : "Skip"}
                      </button>
                    )}
                  </div>
                </section>
              )}
              {step >= 3 && (
                <>
                  {selected.length > 0 && (
                    <div className="gift-answer">{selected.join(", ")}</div>
                  )}
                  <section
                    data-gift-step="3"
                    className={step > 3 ? "gift-history" : ""}
                  >
                    <div className="gift-message">
                      What’s your budget for this gift?
                    </div>
                    <p>
                      <em>Choose the range that fits.</em>
                    </p>
                    <div className="gift-options">
                      {[
                        "Under $25",
                        "Under $50",
                        "Under $100",
                        "Under $200",
                        "$200+",
                        "Any Budget",
                      ].map((value) => (
                        <button
                          key={value}
                          disabled={step !== 3}
                          aria-pressed={budget === value}
                          onClick={() => advance(4, { budget: value })}
                        >
                          <GiftGlyph label={value} />
                          {value}
                        </button>
                      ))}
                    </div>
                  </section>
                </>
              )}
              {step >= 4 && (
                <>
                  <div className="gift-answer">{budget}</div>
                  <section
                    data-gift-step="4"
                    className={completed ? "gift-history" : ""}
                  >
                    <div className="gift-message">
                      Anything else that might help us find the perfect gift?
                    </div>
                    <p>
                      <em>Optional, type any extra details.</em>
                    </p>
                    {step === 4 && !access && (
                      <button
                        className={`gift-action ${styles.skip}`}
                        onClick={requestIdeas}
                      >
                        Skip
                      </button>
                    )}
                  </section>
                </>
              )}
              {(completed || access) && notes && (
                <div className="gift-answer" data-gift-note>
                  {notes}
                </div>
              )}
              {step === 6 && (
                <div className="gift-message" data-gift-step="6">
                  <div className={styles.finding} role="status">
                    <span className={styles.spinner} />
                    Finding gifts that match your answers...
                  </div>
                  <button
                    className={styles.giftPlayback}
                    onClick={() => advance(5, {}, true)}
                  >
                    View captured gift ideas
                  </button>
                </div>
              )}
              {step === 5 && (
                <section data-gift-step="5">
                  <div className="gift-message">
                    He’s a thoughtful, tech-loving guy who enjoys quiet
                    creativity and outdoor fun, so these picks balance his
                    passions and offer comfort and inspiration.
                  </div>
                  <div className="gift-results">
                    {products.map((product) => (
                      <article
                        className="gift-result-row"
                        key={product.id}
                        data-product-id={product.id}
                      >
                        <SourceLink href={`/products/${product.id}`}>
                          {loadingResults ? (
                            <span
                              className={styles.giftImagePlaceholder}
                              aria-label="Loading captured product image"
                            />
                          ) : (
                            <img src={product.images[0]} alt={product.title} />
                          )}
                          <span>
                            {product.title}
                            <span className="gift-product-rating">
                              ★★★★★ ({product.ratingCount})
                            </span>
                            <strong
                              className={
                                product.compareAt ? "gift-sale-price" : ""
                              }
                            >
                              ${(product.price.amount / 100).toFixed(2)}{" "}
                              {product.compareAt && (
                                <del>
                                  ${(product.compareAt.amount / 100).toFixed(2)}
                                </del>
                              )}
                            </strong>
                          </span>
                        </SourceLink>
                        <button
                          aria-label={`${state.saved.includes(product.id) ? "Unsave" : "Save"} ${product.title}`}
                          aria-pressed={state.saved.includes(product.id)}
                          onClick={() => state.toggleSaved(product.id)}
                        >
                          <Icon
                            name="heart"
                            filled={state.saved.includes(product.id)}
                          />
                        </button>
                      </article>
                    ))}
                  </div>
                  <div className="gift-result-actions">
                    <button onClick={() => setSimilar(true)}>
                      Show Similar Gifts
                    </button>
                    <button
                      onClick={() => {
                        if (!saved) {
                          const collectionId = state.createCollection(
                            "Gift ideas",
                            products.map((product) => product.id),
                          );
                          remember({ ...answers, collectionId });
                        }
                      }}
                    >
                      {saved ? "Saved as Collection" : "Save as Collection"}
                    </button>
                  </div>
                  <button
                    className={`gift-action ${styles.differentIdeas}`}
                    onClick={() => {
                      advance(1, { collectionId: "" });
                    }}
                  >
                    Show Me Different Ideas
                  </button>
                </section>
              )}
            </>
          )}
        </div>
        <form
          className="gift-composer"
          onSubmit={(event) => {
            event.preventDefault();
            if (!draft.trim()) return;
            if (step === 1) advance(2, { recipient: draft.trim() });
            else if (step === 2)
              advance(3, {
                selected: [
                  ...selected.filter((value) => value !== draft.trim()),
                  draft.trim(),
                ],
              });
            else if (step === 3) advance(4, { budget: draft.trim() });
            else if (step === 4) requestIdeas();
          }}
        >
          <input
            ref={composer}
            disabled={!canType}
            placeholder={
              !canType
                ? "Please select an option above."
                : step === 4
                  ? "Add any special notes..."
                  : step === 1
                    ? "Type here..."
                    : "Type your answer..."
            }
            aria-label={step === 4 ? "Optional gift notes" : "Gift answer"}
            value={canType ? draft : ""}
            onChange={(event) =>
              remember({
                ...answers,
                drafts: { ...answers.drafts, [step]: event.target.value },
              })
            }
          />
          <button
            className="icon-button"
            type="submit"
            aria-label="Continue gift questions"
            disabled={!canType || !draft.trim()}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m3 10 18-7-7 18-3-8-8-3Zm8 3 10-10" />
            </svg>
          </button>
        </form>
        <MiniAccess
          open={access}
          name="Gift Sense"
          className={styles.giftAccess}
          accessDescription="This local preview keeps your profile, gift answers, and saved products private and does not send them to Gift Sense."
          profileImageSrc="/api/reference-media/auth-reference-avatar"
          profileImageRequiresName
          onClose={() => {
            setAccess(false);
            requestAnimationFrame(() =>
              composer.current?.focus({ preventScroll: true }),
            );
          }}
          onContinue={() => {
            setAccess(false);
            advance(6);
          }}
        />
      </section>
      <Sheet
        open={menu}
        title="Gift Sense preview"
        onClose={() => setMenu(false)}
      >
        <p className="sheet-copy">
          This preview plays the captured gift questions and product examples
          locally. It does not generate or send a personalized gift request.
          Saved products and collections use this browser’s existing preview
          state.
        </p>
        <button className="account-row" onClick={restart}>
          Restart gift questions
        </button>
      </Sheet>
      <Sheet
        open={similar}
        title="Recorded gift ideas"
        onClose={() => setSimilar(false)}
      >
        <p className="sheet-copy">
          These are the three product ideas included in the recording. More
          recommendations are not connected. You can keep these ideas or answer
          the questions again.
        </p>
        <button
          className="primary form-submit"
          onClick={() => setSimilar(false)}
        >
          Keep these ideas
        </button>
        <button
          className="account-row"
          onClick={() => {
            setSimilar(false);
            advance(1);
          }}
        >
          Answer again
        </button>
      </Sheet>
    </MiniShell>
  );
}
