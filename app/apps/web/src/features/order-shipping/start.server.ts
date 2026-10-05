import "server-only";
import type { SellerDatabase } from "../../server/db/database";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import type { ReviewSource } from "../purchase-reviews/model";
import type { Language } from "./model";
import { readShippingContext } from "./queries.server";
import { shippingStartHref } from "./integration";
export async function readShippingStartEligibility(
  database: SellerDatabase,
  identity: VerifiedIdentity,
  source: ReviewSource,
  language: Language,
) {
  const context = await readShippingContext(
    database,
    identity,
    source,
    language,
  );
  return {
    available: context.available,
    href: context.available ? shippingStartHref(source, language) : null,
  };
}
