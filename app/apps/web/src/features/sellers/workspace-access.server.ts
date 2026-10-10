import "server-only";
import type { SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { listOwnedSellers, readSellerContext } from "./persistence.server";
import { readSignupIntent, readSellerSetupReview } from "./setup.server";
import { readAdminProducts } from "./admin-products.server";
import { readTeam, readIncomingInvitations } from "../team/persistence.server";
import { readVerifiedRecipient } from "../team/recipient.server";
import { readListingDraft } from "../selling/drafts.server";
import { readPublicationReview } from "../selling/publication.server";
import { readInventory } from "../inventory/queries.server";
import { readInventoryIndex } from "../inventory/index.server";
import { readSellerDecisions } from "../trust/report-views.server";
import { readSellerModerationQueue } from "../trust/seller-moderation.server";
import { readCatalogueImport, readCatalogueImports } from "../catalogue-import/queries.server";
import { readInbox, readConversation } from "../messaging/inbox.server";
import { readInquiryQueue, readInquiryDetail } from "../merchant-inquiries/queries.server";
import { readNotificationFeed } from "../notifications/queries.server";
import { readDecisionUpdates } from "../trust/decision-updates.server";
import { readReservationQueue } from "../purchase-reviews/reservations.server";
import { readPaidOrders } from "../payments/orders.server";
import { readSellerOrderIndex } from "../payments/order-index.server";
import { readSellerCustomers } from "./customers.server";
import { readSellHelper } from "../assistant-tools/sell-helper.server";
import { validId } from "../selling/draft-model";
import { readOrderAftercare } from "../order-aftercare/queries.server";
import { readSellerBilling } from "../seller-billing/queries.server";
import { readPromotions } from "../promotions/queries.server";
import { readServiceSettings } from "../seller-settings/persistence.server";
import { readSavedBusinessStorePreview } from "../seller-settings/store-preview.server";
import { readInsights } from "../insights/queries.server";
import { SellerError } from "./errors";
import { parseWorkspaceAccessRoute, type WorkspaceAccessView } from "./workspace-access";

/** Page owners validate current resource and query-selected authority. This read
 * returns no private page payload and creates no membership or human account. */
export async function readWorkspaceAccess(database: SellerDatabase, identity: VerifiedIdentity, raw: unknown): Promise<WorkspaceAccessView> {
  const { route, page, sellerId, resourceId, query } = parseWorkspaceAccessRoute(raw);
  const { lang, ...filters } = query;
  if (page === "invitations") {
    const recipient = await readVerifiedRecipient(identity);
    const invitations = recipient.verifiedEmails.length ? await readIncomingInvitations(database, recipient) : [];
    if (resourceId && !invitations.some((item) => item.id === resourceId)) throw new SellerError("NOT_FOUND");
  } else if (!sellerId) await readSignupIntent(database, identity);
  else {
    await readSellerContext(database, identity, sellerId);
    switch (page) {
      case "team": await readTeam(database, identity, sellerId); break;
      case "listings": await readAdminProducts(database, identity, sellerId, query); break;
      case "listings/new": await readSellerContext(database, identity, sellerId, "listing.write"); break;
      case "edit":
        await readSellerContext(database, identity, sellerId, "listing.write");
        await readListingDraft(database, identity, sellerId, resourceId!); break;
      case "review":
        await readPublicationReview(database, identity, sellerId, resourceId!);
        await readInventory(database, identity, { sellerId, listingId: resourceId }); break;
      case "decision": await readSellerDecisions(database, identity, sellerId, resourceId!); break;
      case "moderation": await readSellerModerationQueue(database, identity, { sellerId, ...filters }); break;
      case "inventory": await readInventoryIndex(database, identity, sellerId, query); break;
      case "imports": await readCatalogueImports(database, identity, { sellerId, ...filters }); break;
      case "import":
        if (filters.after !== undefined && !/^\d+$/.test(filters.after)) throw new SellerError("INVALID_INPUT");
        await readCatalogueImport(database, identity, { sellerId, importId: resourceId, after: filters.after === undefined ? 0 : Number(filters.after) }); break;
      case "inbox":
      case "conversation":
        await readInbox(database, identity, { sellerId, ...filters });
        if (resourceId) await readConversation(database, identity, { sellerId, threadId: resourceId }); break;
      case "inquiries": await readInquiryQueue(database, identity, { sellerId, ...filters }); break;
      case "inquiry": await readInquiryDetail(database, identity, sellerId, resourceId!); break;
      case "notifications":
        await readNotificationFeed(database, identity, { sellerId, ...filters });
        await readDecisionUpdates(database, identity, sellerId); break;
      case "reservations":
        if (filters.view !== undefined && !["active", "history"].includes(filters.view)) throw new SellerError("INVALID_INPUT");
        await readReservationQueue(database, identity, { ...filters, sellerId, view: filters.view === "history" ? "history" : "active" }); break;
      case "orders": await readSellerOrderIndex(database, identity, sellerId, query); break;
      case "customers": await readSellerCustomers(database, identity, sellerId, query); break;
      case "order": await readPaidOrders(database, identity, sellerId, resourceId ?? undefined); break;
      case "sell-helper":
        await readSellerContext(database, identity, sellerId, "listing.read");
        await readSellHelper(database, identity, sellerId);
        if (filters.draftId !== undefined) {
          if (!validId(filters.draftId)) throw new SellerError("INVALID_INPUT");
          await readListingDraft(database, identity, sellerId, filters.draftId);
        }
        break;
      case "support": await readOrderAftercare(database, identity, sellerId, resourceId!, lang === "en" ? "en" : "bg"); break;
      case "billing": await readSellerBilling(database, identity, sellerId); break;
      case "promotions": await readPromotions(database, identity, sellerId); break;
      case "settings/contact":
      case "settings/delivery": await readServiceSettings(database, identity, sellerId, page === "settings/contact" ? "contact" : "delivery"); break;
      case "settings/store": await readSellerContext(database, identity, sellerId, "profile.manage"); break;
      case "settings/store/preview": await readSavedBusinessStorePreview(database, identity, sellerId); break;
      case "onboarding": await readSellerSetupReview(database, identity, sellerId); break;
      case "insights": await readInsights(database, identity, { kind: "seller", sellerId }, query); break;
      // Overview and safe readiness have seller.read; optional projections use
      // the complete capability snapshot returned below.
    }
  }
  const sellers = await listOwnedSellers(database, identity);
  return { actorSubject: identity.subject, route, sellers: sellers.map(({ sellerId, capabilities }) => ({ sellerId, capabilities })) };
}
