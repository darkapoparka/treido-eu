import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  context: vi.fn(),
  intent: vi.fn(),
  setup: vi.fn(),
  products: vi.fn(),
  team: vi.fn(),
  invitations: vi.fn(),
  recipient: vi.fn(),
  draft: vi.fn(),
  publication: vi.fn(),
  inventory: vi.fn(),
  index: vi.fn(),
  decision: vi.fn(),
  moderation: vi.fn(),
  imports: vi.fn(),
  import: vi.fn(),
  inbox: vi.fn(),
  conversation: vi.fn(),
  inquiries: vi.fn(),
  inquiry: vi.fn(),
  feed: vi.fn(),
  updates: vi.fn(),
  reservations: vi.fn(),
  orders: vi.fn(),
  aftercare: vi.fn(),
  billing: vi.fn(),
  promotions: vi.fn(),
  service: vi.fn(),
  preview: vi.fn(),
  insights: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("./persistence.server", () => ({
  listOwnedSellers: mocks.list,
  readSellerContext: mocks.context,
}));
vi.mock("./setup.server", () => ({
  readSignupIntent: mocks.intent,
  readSellerSetupReview: mocks.setup,
}));
vi.mock("./admin-products.server", () => ({
  readAdminProducts: mocks.products,
}));
vi.mock("../team/persistence.server", () => ({
  readTeam: mocks.team,
  readIncomingInvitations: mocks.invitations,
}));
vi.mock("../team/recipient.server", () => ({
  readVerifiedRecipient: mocks.recipient,
}));
vi.mock("../selling/drafts.server", () => ({ readListingDraft: mocks.draft }));
vi.mock("../selling/publication.server", () => ({
  readPublicationReview: mocks.publication,
}));
vi.mock("../inventory/queries.server", () => ({
  readInventory: mocks.inventory,
}));
vi.mock("../inventory/index.server", () => ({
  readInventoryIndex: mocks.index,
}));
vi.mock("../trust/report-views.server", () => ({
  readSellerDecisions: mocks.decision,
}));
vi.mock("../trust/seller-moderation.server", () => ({
  readSellerModerationQueue: mocks.moderation,
}));
vi.mock("../catalogue-import/queries.server", () => ({
  readCatalogueImport: mocks.import,
  readCatalogueImports: mocks.imports,
}));
vi.mock("../messaging/inbox.server", () => ({
  readInbox: mocks.inbox,
  readConversation: mocks.conversation,
}));
vi.mock("../merchant-inquiries/queries.server", () => ({
  readInquiryQueue: mocks.inquiries,
  readInquiryDetail: mocks.inquiry,
}));
vi.mock("../notifications/queries.server", () => ({
  readNotificationFeed: mocks.feed,
}));
vi.mock("../trust/decision-updates.server", () => ({
  readDecisionUpdates: mocks.updates,
}));
vi.mock("../purchase-reviews/reservations.server", () => ({
  readReservationQueue: mocks.reservations,
}));
vi.mock("../payments/orders.server", () => ({ readPaidOrders: mocks.orders }));
vi.mock("../order-aftercare/queries.server", () => ({
  readOrderAftercare: mocks.aftercare,
}));
vi.mock("../seller-billing/queries.server", () => ({
  readSellerBilling: mocks.billing,
}));
vi.mock("../promotions/queries.server", () => ({
  readPromotions: mocks.promotions,
}));
vi.mock("../seller-settings/persistence.server", () => ({
  readServiceSettings: mocks.service,
}));
vi.mock("../seller-settings/store-preview.server", () => ({
  readSavedBusinessStorePreview: mocks.preview,
}));
vi.mock("../insights/queries.server", () => ({ readInsights: mocks.insights }));
import { readWorkspaceAccess } from "./workspace-access.server";
import { SellerError } from "./errors";
import type { SellerDatabase } from "../../server/db/database";
const database = {} as SellerDatabase,
  identity = { subject: "synthetic-human" };
const seller = "10000000-0000-4000-8000-000000000001",
  resource = "20000000-0000-4000-8000-000000000002",
  base = "/app/sellers/" + seller;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.context.mockResolvedValue({
    sellerId: seller,
    capabilities: ["seller.read"],
  });
  mocks.list.mockResolvedValue([
    {
      sellerId: seller,
      name: "Private shell name",
      capabilities: ["seller.read"],
    },
  ]);
});
describe("current workspace route reader delegation (native owner authority is qualified separately)", () => {
  it("cannot use seller.read to reveal retained Team data after manager becomes viewer", async () => {
    mocks.team.mockRejectedValue(new SellerError("FORBIDDEN"));
    await expect(
      readWorkspaceAccess(database, identity, base + "/team"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.team).toHaveBeenCalledWith(database, identity, seller);
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("qualifies the exact selected resource and preserves its current owner denial", async () => {
    mocks.draft.mockRejectedValue(new SellerError("FORBIDDEN"));
    await expect(
      readWorkspaceAccess(
        database,
        identity,
        base + "/listings/" + resource + "/edit",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.context).toHaveBeenCalledWith(
      database,
      identity,
      seller,
      "listing.write",
    );
    expect(mocks.draft).toHaveBeenCalledWith(
      database,
      identity,
      seller,
      resource,
    );
    mocks.conversation.mockRejectedValue(new SellerError("NOT_FOUND"));
    await expect(
      readWorkspaceAccess(database, identity, base + "/inbox/" + resource),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.conversation).toHaveBeenCalledWith(database, identity, {
      sellerId: seller,
      threadId: resource,
    });
  });
  it("passes the query-selected Insights dataset to its existing current authority owner", async () => {
    mocks.insights.mockRejectedValue(new SellerError("FORBIDDEN"));
    await expect(
      readWorkspaceAccess(
        database,
        identity,
        base + "/insights?dataset=imports&lang=en&capability=seller.read",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.insights).toHaveBeenCalledWith(
      database,
      identity,
      { kind: "seller", sellerId: seller },
      { lang: "en", dataset: "imports" },
    );
  });
  it("rechecks current verified recipient ownership for an invitation detail", async () => {
    const recipient = {
      ...identity,
      verifiedEmails: ["synthetic@example.invalid"],
    };
    mocks.recipient.mockResolvedValue(recipient);
    mocks.invitations.mockResolvedValue([]);
    await expect(
      readWorkspaceAccess(database, identity, "/app/invitations/" + resource),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.invitations).toHaveBeenCalledWith(database, recipient);
  });
  it("returns only verified actor, exact route and current capability facts, with no private page payload", async () => {
    mocks.team.mockResolvedValue({
      members: [{ email: "private@example.invalid" }],
    });
    const route = base + "/team?lang=bg";
    expect(await readWorkspaceAccess(database, identity, route)).toEqual({
      actorSubject: "synthetic-human",
      route,
      sellers: [{ sellerId: seller, capabilities: ["seller.read"] }],
    });
  });
  it("does not read any authority or private resource for an unsupported route", async () => {
    await expect(
      readWorkspaceAccess(database, identity, base + "/invented"),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(mocks.context).not.toHaveBeenCalled();
    expect(mocks.list).not.toHaveBeenCalled();
  });
});
