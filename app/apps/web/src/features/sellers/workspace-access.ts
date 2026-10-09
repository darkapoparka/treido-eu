import type { SellerCapability } from "./capabilities";
import { SellerError } from "./errors";
import { validId } from "../selling/draft-model";

export type WorkspaceSellerAccess = {
  sellerId: string;
  capabilities: readonly SellerCapability[];
};
export type WorkspaceAccessView = {
  actorSubject: string;
  route: string;
  sellers: readonly WorkspaceSellerAccess[];
};
const sellerPages = [
  "",
  "billing",
  "imports",
  "inbox",
  "inquiries",
  "insights",
  "inventory",
  "listings",
  "listings/new",
  "moderation",
  "notifications",
  "onboarding",
  "orders",
  "promotions",
  "reservations",
  "settings",
  "settings/contact",
  "settings/delivery",
  "settings/payments",
  "settings/payments/refresh",
  "settings/store",
  "settings/store/preview",
  "team",
] as const;
type SellerPage = (typeof sellerPages)[number];
export type WorkspacePage =
  | SellerPage
  | "human"
  | "invitations"
  | "import"
  | "conversation"
  | "inquiry"
  | "edit"
  | "review"
  | "decision"
  | "order"
  | "support";
const queryKeys: Partial<Record<WorkspacePage, readonly string[]>> = {
  imports: ["before"],
  import: ["after"],
  inbox: ["q", "filter", "cursor"],
  conversation: ["q", "filter", "cursor"],
  inquiries: ["status", "before", "q"],
  insights: [
    "dataset",
    "from",
    "to",
    "status",
    "kind",
    "q",
    "page",
    "reason",
    "age",
  ],
  inventory: ["q", "status", "cursor"],
  listings: ["q", "status", "sort", "cursor"],
  notifications: ["filter", "kind", "q", "before"],
  moderation: ["state", "q", "before"],
  reservations: ["view", "before", "q"],
};

/** A finite page selector; route text never supplies a role or capability. */
export function parseWorkspaceAccessRoute(raw: unknown) {
  if (
    typeof raw !== "string" ||
    raw.length > 4096 ||
    !raw.startsWith("/app") ||
    /[\\#\u0000-\u0020\u007f]/.test(raw)
  )
    throw new SellerError("INVALID_INPUT");
  const url = new URL(raw, "https://workspace.invalid");
  if (
    url.origin !== "https://workspace.invalid" ||
    url.pathname.includes("%") ||
    url.pathname.includes("//") ||
    url.pathname !== raw.split("?")[0]
  )
    throw new SellerError("INVALID_INPUT");
  let page: WorkspacePage,
    sellerId: string | null = null,
    resourceId: string | null = null;
  if (
    ["/app", "/app/intent", "/app/onboarding", "/app/products"].includes(
      url.pathname,
    )
  )
    page = "human";
  else if (url.pathname === "/app/invitations") page = "invitations";
  else if (url.pathname.startsWith("/app/invitations/")) {
    page = "invitations";
    resourceId = url.pathname.slice("/app/invitations/".length);
    if (!validId(resourceId)) throw new SellerError("INVALID_INPUT");
  } else {
    const match = /^\/app\/sellers\/([^/]+)(?:\/(.*))?$/.exec(url.pathname);
    if (!match || !validId(match[1])) throw new SellerError("INVALID_INPUT");
    sellerId = match[1];
    const suffix = match[2] ?? "";
    if ((sellerPages as readonly string[]).includes(suffix))
      page = suffix as SellerPage;
    else {
      const resource =
          /^(imports|inbox|inquiries|orders)\/([^/]+)(\/support)?$/.exec(
            suffix,
          ),
        listing = /^listings\/([^/]+)\/(edit|review|moderation)$/.exec(suffix);
      if (
        resource &&
        validId(resource[2]) &&
        (!resource[3] || resource[1] === "orders")
      ) {
        resourceId = resource[2];
        page = resource[3]
          ? "support"
          : (
              {
                imports: "import",
                inbox: "conversation",
                inquiries: "inquiry",
                orders: "order",
              } as const
            )[resource[1] as "imports" | "inbox" | "inquiries" | "orders"];
      } else if (listing && validId(listing[1])) {
        resourceId = listing[1];
        page =
          listing[2] === "moderation"
            ? "decision"
            : (listing[2] as "edit" | "review");
      } else throw new SellerError("INVALID_INPUT");
    }
  }
  // Unused presentation/continuation params are omitted. Each reader validates
  // its own supported values; duplicate supported values are ambiguous.
  const query: Record<string, string> = {};
  for (const key of ["lang", ...(queryKeys[page] ?? [])]) {
    const values = url.searchParams.getAll(key);
    if (values.length > 1) throw new SellerError("INVALID_INPUT");
    if (values.length) query[key] = values[0];
  }
  if (query.lang !== undefined && !["bg", "en"].includes(query.lang))
    throw new SellerError("INVALID_INPUT");
  return { route: raw, page, sellerId, resourceId, query };
}

export function workspaceSnapshotVersion(
  sellers: readonly WorkspaceSellerAccess[],
) {
  return JSON.stringify(
    sellers
      .map(
        ({ sellerId, capabilities }) =>
          [sellerId, [...capabilities].sort()] as const,
      )
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

/** Includes every shell seller and optional permission used by retained JSX. */
export function retainsWorkspaceAccess(
  original: readonly WorkspaceSellerAccess[],
  current: readonly WorkspaceSellerAccess[],
) {
  return original.every((before) => {
    const after = current.find((seller) => seller.sellerId === before.sellerId);
    return (
      !!after &&
      before.capabilities.every((capability) =>
        after.capabilities.includes(capability),
      )
    );
  });
}
