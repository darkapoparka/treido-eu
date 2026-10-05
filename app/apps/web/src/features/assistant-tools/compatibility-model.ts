import {
  getCategory,
  validateCategoryAttributeValue,
  type CategoryLeafId,
  type AttributeDefinition,
} from "@treido/contracts/categories";
import type { DiscoveryAttribute } from "../catalog/discovery-input";
import type { ToolListing, Observation } from "../shopping-tools/model";
import { observe } from "../shopping-tools/model";
import { onlyKeys, whole } from "../inventory/model";
import { validId } from "../selling/draft-model";
import { SellerError } from "../sellers/errors";
import { ASSISTANT_LIMITS } from "./limits";
import {
  evidenceNumber,
  compareEvidenceNumbers,
  type EvidenceNumber,
} from "./numeric-evidence";

export type Requirement = {
  field: string;
  operator: "equal" | "at_least" | "at_most";
  value: DiscoveryAttribute;
};
export type Requirements = {
  categoryId: CategoryLeafId;
  fields: Requirement[];
};
export type Evidence = {
  field: string;
  required: DiscoveryAttribute;
  operator: Requirement["operator"];
  declared: DiscoveryAttribute | null;
  outcome:
    "agreement" | "disagreement" | "missing" | "incomparable" | "unknown";
};
export type CompatibilitySnapshot = {
  observation: Observation;
  categoryId: string;
  attributes: Record<string, DiscoveryAttribute>;
};
export type CompatibilityItem = {
  listingId: string;
  position: number;
  observedAt: string;
  observed: CompatibilitySnapshot | null;
  current: ToolListing | null;
  evidence: Evidence[];
  changed: boolean;
};
export type CompatibilityView = {
  actorKey: string;
  revision: number;
  requirements: Requirements | null;
  items: CompatibilityItem[];
  checkedAt: string;
};
export type CompatibilityCommand = {
  actorKey: string;
  expectedRevision: number;
  requestId: string;
  operation:
    | {
        kind: "check";
        requirements: Requirements;
        snapshots: CompatibilitySnapshot[];
      }
    | { kind: "refresh"; snapshots: CompatibilitySnapshot[] }
    | { kind: "clear"; listingIds: string[] };
};
export type CompatibilityChange = { revision: number; replayed: boolean };
const invalid = (): never => {
  throw new SellerError("INVALID_INPUT");
};
export function assistantId(value: unknown): string {
  if (!validId(value)) return invalid();
  return value.toLowerCase();
}
export function commandEnvelope(value: unknown): asserts value is Record<
  string,
  unknown
> & {
  actorKey: string;
  expectedRevision: number;
  requestId: string;
} {
  if (
    !onlyKeys(value, [
      "actorKey",
      "expectedRevision",
      "requestId",
      "operation",
      "sellerId",
    ]) ||
    typeof value.actorKey !== "string" ||
    !/^[a-f0-9]{64}$/.test(value.actorKey) ||
    !whole(value.expectedRevision, 0, 2147483646) ||
    !validId(value.requestId) ||
    new TextEncoder().encode(JSON.stringify(value)).byteLength >
      ASSISTANT_LIMITS.commandBytes
  )
    invalid();
}
export function parseRequirements(raw: unknown): Requirements {
  if (
    !onlyKeys(raw, ["categoryId", "fields"]) ||
    typeof raw.categoryId !== "string" ||
    !Array.isArray(raw.fields) ||
    raw.fields.length < 1 ||
    raw.fields.length > ASSISTANT_LIMITS.requirements
  )
    return invalid();
  const category = getCategory(raw.categoryId);
  if (category?.kind !== "leaf") return invalid();
  const fields: Requirement[] = raw.fields.map((item: unknown) => {
    if (
      !onlyKeys(item, ["field", "operator", "value"]) ||
      typeof item.field !== "string"
    )
      return invalid();
    const definition = category.profile.fields.find(
      (field) => field.id === item.field,
    );
    if (
      !definition ||
      !["equal", "at_least", "at_most"].includes(String(item.operator)) ||
      (item.operator !== "equal" &&
        !["integer", "decimal", "dimension"].includes(definition.type))
    )
      return invalid();
    const parsed = validateCategoryAttributeValue(
      category.id,
      definition.id,
      item.value,
    );
    if (!parsed.ok) return invalid();
    return {
      field: definition.id,
      operator: item.operator as Requirement["operator"],
      value: parsed.attributes[definition.id] as DiscoveryAttribute,
    };
  });
  if (new Set(fields.map((field) => field.field)).size !== fields.length)
    return invalid();
  return {
    categoryId: category.id,
    fields: fields.sort((a, b) => a.field.localeCompare(b.field)),
  };
}
export function snapshotCompatibility(
  item: ToolListing,
): CompatibilitySnapshot {
  return {
    observation: observe(item),
    categoryId: item.card.categoryId,
    attributes: item.attributes,
  };
}
function parseSnapshot(raw: unknown): CompatibilitySnapshot {
  if (
    !onlyKeys(raw, ["observation", "categoryId", "attributes"]) ||
    !onlyKeys(raw.observation, [
      "listingId",
      "publicationRevision",
      "skuId",
      "priceMinor",
      "stock",
    ]) ||
    typeof raw.categoryId !== "string" ||
    !onlyKeys(raw.attributes, Object.keys(raw.attributes ?? {}))
  )
    return invalid();
  const category = getCategory(raw.categoryId),
    o = raw.observation;
  if (
    category?.kind !== "leaf" ||
    !whole(o.publicationRevision, 2, 2147483646) ||
    !whole(o.priceMinor, 0, 1000000000) ||
    !["unknown", "available", "reserved", "out_of_stock"].includes(
      String(o.stock),
    )
  )
    return invalid();
  const attributes: Record<string, DiscoveryAttribute> = {};
  for (const [key, value] of Object.entries(raw.attributes)) {
    const parsed = validateCategoryAttributeValue(category.id, key, value);
    if (!parsed.ok) return invalid();
    attributes[key] = parsed.attributes[key] as DiscoveryAttribute;
  }
  return {
    categoryId: category.id,
    attributes,
    observation: {
      listingId: assistantId(o.listingId),
      publicationRevision: o.publicationRevision,
      skuId: o.skuId === null ? null : assistantId(o.skuId),
      priceMinor: o.priceMinor,
      stock: o.stock as Observation["stock"],
    },
  };
}
export function parseCompatibilityCommand(raw: unknown): CompatibilityCommand {
  commandEnvelope(raw);
  if (
    !onlyKeys(raw, [
      "actorKey",
      "expectedRevision",
      "requestId",
      "operation",
    ]) ||
    !onlyKeys(raw.operation, [
      "kind",
      "requirements",
      "snapshots",
      "listingIds",
    ])
  )
    return invalid();
  const op = raw.operation;
  let operation: CompatibilityCommand["operation"];
  if (
    (op.kind === "check" || op.kind === "refresh") &&
    onlyKeys(
      op,
      op.kind === "check"
        ? ["kind", "requirements", "snapshots"]
        : ["kind", "snapshots"],
    ) &&
    Array.isArray(op.snapshots) &&
    op.snapshots.length >= 1 &&
    op.snapshots.length <= ASSISTANT_LIMITS.selections
  ) {
    const snapshots = op.snapshots.map(parseSnapshot);
    if (
      new Set(snapshots.map((s) => s.observation.listingId)).size !==
      snapshots.length
    )
      return invalid();
    operation =
      op.kind === "check"
        ? {
            kind: "check",
            requirements: parseRequirements(op.requirements),
            snapshots,
          }
        : { kind: "refresh", snapshots };
  } else if (
    op.kind === "clear" &&
    onlyKeys(op, ["kind", "listingIds"]) &&
    Array.isArray(op.listingIds) &&
    op.listingIds.length <= ASSISTANT_LIMITS.selections
  ) {
    const listingIds = op.listingIds.map(assistantId).sort();
    if (new Set(listingIds).size !== listingIds.length) return invalid();
    operation = { kind: "clear", listingIds };
  } else return invalid();
  return {
    actorKey: raw.actorKey,
    expectedRevision: raw.expectedRevision,
    requestId: assistantId(raw.requestId),
    operation,
  };
}
const uncertain = (value: DiscoveryAttribute) =>
  typeof value === "string"
    ? ["unknown", "other", "not_applicable"].includes(value)
    : Array.isArray(value) &&
      value.some((item) =>
        ["unknown", "other", "not_applicable"].includes(item),
      );
function numeric(
  definition: AttributeDefinition,
  value: DiscoveryAttribute,
): EvidenceNumber[] | null {
  if (definition.type === "integer" && typeof value === "number") {
    const parsed = evidenceNumber(value);
    return parsed ? [parsed] : null;
  }
  if (
    definition.type === "decimal" &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "value" in value &&
    value.unit === definition.unit
  ) {
    const parsed = evidenceNumber(value.value);
    return parsed ? [parsed] : null;
  }
  if (
    definition.type === "dimension" &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "width" in value
  ) {
    const scale = { mm: 1, cm: 10, m: 1000 }[value.unit as "mm" | "cm" | "m"];
    if (!scale) return null;
    const parsed = [value.width, value.height, value.depth].map((n) =>
      evidenceNumber(n, scale),
    );
    return parsed.every((n): n is EvidenceNumber => n !== null) ? parsed : null;
  }
  return null;
}
/** Agreement describes declared fields. It is never a fit, authenticity or safety verdict.
 * Dimensions use the declared axis order; neither rotation nor SKU fit is inferred. */
export function compatibilityEvidence(
  requirements: Requirements,
  facts: CompatibilitySnapshot,
): Evidence[] {
  const wanted = getCategory(requirements.categoryId),
    actual = getCategory(facts.categoryId);
  if (wanted?.kind !== "leaf") return invalid();
  return requirements.fields.map((requirement) => {
    const definition = wanted.profile.fields.find(
      (f) => f.id === requirement.field,
    );
    const actualDefinition =
      actual?.kind === "leaf"
        ? actual.profile.fields.find((f) => f.id === requirement.field)
        : undefined;
    const declared = facts.attributes[requirement.field] ?? null;
    const base = {
      field: requirement.field,
      required: requirement.value,
      operator: requirement.operator,
      declared,
    };
    if (
      !definition ||
      !actualDefinition ||
      actual?.kind !== "leaf" ||
      actual.profile.id !== wanted.profile.id ||
      definition.type !== actualDefinition.type
    )
      return { ...base, outcome: "incomparable" };
    if (declared === null) return { ...base, outcome: "missing" };
    if (uncertain(declared) || uncertain(requirement.value))
      return { ...base, outcome: "unknown" };
    if (
      !validateCategoryAttributeValue(actual.id, requirement.field, declared).ok
    )
      return { ...base, outcome: "incomparable" };
    const left = numeric(definition, declared),
      right = numeric(definition, requirement.value);
    let agreement: boolean;
    if (left && right && left.length === right.length) {
      agreement = left.every((n, i) => {
        const order = compareEvidenceNumbers(n, right[i]);
        return requirement.operator === "at_least"
          ? order >= 0
          : requirement.operator === "at_most"
            ? order <= 0
            : order === 0;
      });
    } else if (requirement.operator !== "equal")
      return { ...base, outcome: "incomparable" };
    else if (
      typeof declared === "string" &&
      typeof requirement.value === "string"
    )
      agreement =
        declared.trim().normalize("NFC") ===
        requirement.value.trim().normalize("NFC");
    else if (Array.isArray(declared) && Array.isArray(requirement.value))
      agreement =
        [...declared].sort().join("\u0000") ===
        [...requirement.value].sort().join("\u0000");
    else agreement = declared === requirement.value;
    return { ...base, outcome: agreement ? "agreement" : "disagreement" };
  });
}
