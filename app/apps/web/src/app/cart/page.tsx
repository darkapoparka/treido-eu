import { connection } from "next/server";
import {
  readCatalog,
  referencePreviewEnabled,
} from "@/features/catalog/queries.server";
import { CartPage } from "@/features/commerce/checkout";
import { BuyerCartPage } from "@/features/buyer-cart/page";
import { readBuyerCart } from "@/features/buyer-cart/cart.server";
import type { BuyerCart } from "@/features/buyer-cart/model";
import { readVerifiedIdentity } from "@/server/identity/clerk.server";
import { getDatabase } from "@/server/db/database";
export default async function Page() {
  await connection();
  if (referencePreviewEnabled())
    return <CartPage catalog={await readCatalog()} />;
  let initial: BuyerCart | null = null;
  let status: "ready" | "guest" | "error" = "guest";
  let initialSubject: string | null = null;
  try {
    const identity = await readVerifiedIdentity();
    if (identity) {
      initialSubject = identity.subject;
      initial = await readBuyerCart(getDatabase(), identity);
      status = "ready";
    }
  } catch {
    console.error("Treido account cart unavailable.");
    status = "error";
  }
  return (
    <BuyerCartPage
      initial={initial}
      status={status}
      initialSubject={initialSubject}
    />
  );
}
