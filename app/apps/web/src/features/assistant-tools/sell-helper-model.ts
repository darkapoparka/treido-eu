import {
  getCategory,
  validateCategoryAttributes,
  type CategoryLeafId,
  type SellerKind,
} from "@treido/contracts/categories";
import { onlyKeys, whole } from "../inventory/model";
import { parseDraftPayload, type DraftPayload } from "../selling/draft-model";
import {
  fieldHasValue,
  toCategoryAttributes,
  type RawFields,
} from "../selling/form-model";
import { SellerError } from "../sellers/errors";
import { assistantId, commandEnvelope } from "./compatibility-model";
export type HelperEdit = {
  title: string;
  description: string;
  categoryId: CategoryLeafId;
  fields: RawFields;
};
export type HelperIssue = {
  field: string;
  reason: "missing" | "invalid" | "confirm_at_review";
};
export type HelperProposal = {
  id: string;
  draftId: string;
  draftRevision: number;
  baseHash: string;
  proposalHash: string;
  original: HelperEdit;
  edit: HelperEdit;
  issues: HelperIssue[];
  createdAt: string;
  current: boolean;
};
export type HelperCommand = {
  actorKey: string;
  sellerId: string;
  expectedRevision: number;
  requestId: string;
  operation:
    | {
        kind: "prepare";
        draftId: string;
        expectedDraftRevision: number;
        baseHash: string;
        edit: HelperEdit;
        confirmFacts: true;
      }
    | {
        kind: "accept";
        proposalId: string;
        proposalHash: string;
        expectedDraftRevision: number;
        confirm: true;
      }
    | { kind: "discard"; proposalId: string };
};
export type HelperChange = {
  revision: number;
  proposalId: string | null;
  draftId: string | null;
  draftRevision: number | null;
  outcome: "prepared" | "discarded" | "applied" | "conflict";
  replayed: boolean;
};
export type HelperView = {
  actorKey: string;
  sellerId: string;
  revision: number;
  proposals: HelperProposal[];
  pending: HelperCommand | null;
};
const invalid = (): never => {
  throw new SellerError("INVALID_INPUT");
};
const hash = (raw: unknown): string => {
  if (typeof raw !== "string" || !/^[a-f0-9]{64}$/.test(raw)) return invalid();
  return raw;
};
export function editableDraft(payload: DraftPayload): HelperEdit {
  const category = payload.categoryId ? getCategory(payload.categoryId) : null;
  if (category?.kind !== "leaf") return invalid();
  return {
    title: payload.title,
    description: payload.description,
    categoryId: category.id,
    fields: payload.fields,
  };
}
export function parseHelperEdit(raw: unknown): HelperEdit {
  if (!onlyKeys(raw, ["title", "description", "categoryId", "fields"]))
    return invalid();
  const candidate = parseDraftPayload({
    schemaVersion: 1,
    ...raw,
    condition: "",
    priceMinor: null,
    currency: "EUR",
    locality: "",
  });
  if (!candidate?.categoryId) return invalid();
  return editableDraft(candidate);
}
/** Only these four fields can be proposed. Commercial declarations, condition,
 * money, locality, inventory and media stay in their ordinary seller workflows. */
export function applyHelperEdit(
  base: DraftPayload,
  edit: HelperEdit,
  kind: SellerKind,
): DraftPayload {
  const candidate = parseDraftPayload({ ...base, ...parseHelperEdit(edit) });
  const category = candidate?.categoryId
    ? getCategory(candidate.categoryId)
    : null;
  if (
    !candidate ||
    category?.kind !== "leaf" ||
    !category.policy.sellerKinds.includes(kind)
  )
    return invalid();
  if (
    !validateCategoryAttributes(
      category.id,
      toCategoryAttributes(category, candidate.fields),
      true,
    ).ok
  )
    return invalid();
  return candidate;
}
export function inspectHelperDraft(payload: DraftPayload): HelperIssue[] {
  const issues: HelperIssue[] = [],
    category = payload.categoryId ? getCategory(payload.categoryId) : null;
  for (const [field, supplied] of Object.entries({
    title: !!payload.title.trim(),
    description: !!payload.description.trim(),
    categoryId: category?.kind === "leaf",
    condition: !!payload.condition,
    priceMinor: payload.priceMinor !== null,
    locality: !!payload.locality.trim(),
  }))
    if (!supplied) issues.push({ field, reason: "missing" });
  if (category?.kind === "leaf") {
    const validation = validateCategoryAttributes(
      category.id,
      toCategoryAttributes(category, payload.fields),
    );
    if (!validation.ok)
      for (const issue of validation.issues) {
        const field = issue.field.split(".")[0];
        if (!issues.some((i) => i.field === field))
          issues.push({
            field,
            reason: fieldHasValue(payload.fields[field])
              ? "invalid"
              : "missing",
          });
      }
  }
  for (const field of [
    "defects",
    "handover",
    "warranty",
    "stock",
    "photoRights",
  ])
    issues.push({ field, reason: "confirm_at_review" });
  return issues;
}
export function parseHelperCommand(raw: unknown): HelperCommand {
  commandEnvelope(raw);
  if (
    !onlyKeys(raw, [
      "actorKey",
      "sellerId",
      "expectedRevision",
      "requestId",
      "operation",
    ]) ||
    !onlyKeys(raw.operation, [
      "kind",
      "draftId",
      "expectedDraftRevision",
      "baseHash",
      "edit",
      "confirmFacts",
      "proposalId",
      "proposalHash",
      "confirm",
    ])
  )
    return invalid();
  const op = raw.operation;
  let operation: HelperCommand["operation"];
  if (
    op.kind === "prepare" &&
    onlyKeys(op, [
      "kind",
      "draftId",
      "expectedDraftRevision",
      "baseHash",
      "edit",
      "confirmFacts",
    ]) &&
    op.confirmFacts === true &&
    whole(op.expectedDraftRevision, 1, 2147483646)
  )
    operation = {
      kind: "prepare",
      draftId: assistantId(op.draftId),
      expectedDraftRevision: op.expectedDraftRevision,
      baseHash: hash(op.baseHash),
      edit: parseHelperEdit(op.edit),
      confirmFacts: true,
    };
  else if (
    op.kind === "accept" &&
    onlyKeys(op, [
      "kind",
      "proposalId",
      "proposalHash",
      "expectedDraftRevision",
      "confirm",
    ]) &&
    op.confirm === true &&
    whole(op.expectedDraftRevision, 1, 2147483646)
  )
    operation = {
      kind: "accept",
      proposalId: assistantId(op.proposalId),
      proposalHash: hash(op.proposalHash),
      expectedDraftRevision: op.expectedDraftRevision,
      confirm: true,
    };
  else if (op.kind === "discard" && onlyKeys(op, ["kind", "proposalId"]))
    operation = { kind: "discard", proposalId: assistantId(op.proposalId) };
  else return invalid();
  return {
    actorKey: raw.actorKey,
    sellerId: assistantId(raw.sellerId),
    expectedRevision: raw.expectedRevision,
    requestId: assistantId(raw.requestId),
    operation,
  };
}
