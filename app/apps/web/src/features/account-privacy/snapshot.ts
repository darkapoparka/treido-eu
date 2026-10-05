import {
  PRIVACY_LIMITS,
  PrivacyError,
  type ExportCategory,
  type ExportSection,
  type PersonalSnapshot,
  SNAPSHOT_EXCLUSIONS,
} from "./model";
/** Final allowlist boundary. Query results must not carry unselected provider/private columns. */
export const SECTION_FIELDS: Record<ExportCategory, readonly string[]> = {
  account: [
    "id",
    "status",
    "createdAt",
    "kind",
    "locale",
    "browseScope",
    "state",
    "policyVersion",
    "acceptedAt",
  ],
  personalProfile: ["sellerId", "name", "description", "locality"],
  memberships: ["sellerId", "role", "status", "revision"],
  library: ["kind", "resourceId", "name", "active", "recordedAt"],
  cart: ["listingId", "skuId", "quantity", "active", "addedAt"],
  searches: [
    "kind",
    "id",
    "name",
    "status",
    "version",
    "generation",
    "frequencyMinutes",
    "consentAt",
    "processingConsent",
    "processingConsentExpiresAt",
    "criteriaMode",
    "criteriaRegistry",
    "criteriaQuery",
    "context",
    "selection",
    "listingId",
    "publicationRevision",
    "skuId",
    "operation",
    "inputHash",
    "recordedAt",
  ],
  purchases: [
    "kind",
    "id",
    "state",
    "language",
    "fulfilmentState",
    "settlementState",
    "currency",
    "totalMinor",
    "createdAt",
    "orderId",
    "revision",
    "rating",
    "amountMinor",
    "requestId",
    "feedbackId",
    "acceptedRevision",
  ],
};
export function snapshotSection(
  category: ExportCategory,
  rows: Record<string, unknown>[],
): ExportSection {
  const records: ExportSection["records"] = [];
  let bytes = 0;
  for (const row of rows.slice(0, PRIVACY_LIMITS.rows)) {
    const record = Object.fromEntries(
      SECTION_FIELDS[category].map((key) => {
        const value = row[key];
        if (value instanceof Date) return [key, value.toISOString()];
        if (value == null) return [key, null];
        if (typeof value === "string") {
          if (
            value.length >
            (key === "context" ? 16000 : key === "criteriaQuery" ? 6000 : 1500)
          )
            throw new PrivacyError("NOT_AVAILABLE");
          return [key, value];
        }
        if (
          typeof value === "boolean" ||
          (typeof value === "number" && Number.isSafeInteger(value))
        )
          return [key, value];
        throw new PrivacyError("NOT_AVAILABLE");
      }),
    );
    const size = new TextEncoder().encode(JSON.stringify(record)).byteLength;
    if (bytes + size > PRIVACY_LIMITS.sectionBytes) break;
    bytes += size;
    records.push(record);
  }
  return { category, records, limited: rows.length > records.length };
}
export function buildSnapshot(
  accountId: string,
  generatedAt: string,
  sections: ExportSection[],
): PersonalSnapshot {
  const snapshot: PersonalSnapshot = {
    format: "treido-personal-data-v1",
    accountId,
    generatedAt,
    scope: "supported-current-snapshot",
    sections,
    excluded: SNAPSHOT_EXCLUSIONS,
  };
  if (
    new TextEncoder().encode(JSON.stringify(snapshot)).byteLength >
    PRIVACY_LIMITS.bytes
  )
    throw new PrivacyError("QUOTA_EXCEEDED");
  return snapshot;
}
