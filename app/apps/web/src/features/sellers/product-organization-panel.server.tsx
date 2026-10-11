import "server-only";
import type { VerifiedIdentity } from "../../server/identity/clerk.server";
import { getDatabase } from "../../server/db/database";
import { readPrivatePage, recoveryKey } from "./page-context.server";
import { readCatalogCollections, readProductOrganization } from "./catalog-organization.server";
import { ProductOrganizationEditor } from "./product-organization-editor";

export async function ProductOrganizationPanel({ identity, sellerId, listingId, language, canWrite }: {
  identity: VerifiedIdentity; sellerId: string; listingId: string; language: "bg" | "en"; canWrite: boolean;
}) {
  const database = getDatabase();
  const { initial, collections } = await readPrivatePage(async () => ({
    initial: await readProductOrganization(database, identity, sellerId, listingId),
    collections: await readCatalogCollections(database, identity, sellerId),
  }));
  const key = recoveryKey(identity.subject, `${sellerId}/${listingId}/organization`);
  return <ProductOrganizationEditor key={key} sellerId={sellerId} actorSubject={identity.subject} bufferKey={key} language={language} canWrite={canWrite} initial={initial} collections={collections} />;
}
