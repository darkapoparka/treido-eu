export const BUSINESS_SETUP_VERSION = 1;
export const SETUP_STEPS = ["details", "declaration", "review"] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];
export type SignupIntent = "buy" | "personal" | "business" | null;
export type BusinessProfile = {
  name: string;
  description: string;
  locality: string;
};
export type TraderDeclaration = {
  country: "BG";
  legalName: string;
  registrationNumber: string;
  contactEmail: string;
  contactAddress: string;
  accurate: boolean;
};
export type DeclarationStatus =
  "draft" | "review_required" | "accepted" | "rejected";
export type DeclarationReadiness =
  "required" | "review_required" | "current" | "rejected" | "stale";
export type SetupAcknowledgement = {
  sellerId: string;
  revision: number;
  step: SetupStep;
  savedAt: string;
};
export type BusinessSetupView = {
  sellerId: string;
  revision: number;
  lastStep: SetupStep;
  profile: BusinessProfile;
  declaration: TraderDeclaration | null;
  declarationStatus: DeclarationReadiness;
  canEditProfile: boolean;
  canEditDeclaration: boolean;
  hasDraft: boolean | null;
  canCreateDraft: boolean;
  savedAt: string | null;
};
export type SignupIntentView = { intent: SignupIntent; revision: number };

export const emptyDeclaration: TraderDeclaration = {
  country: "BG",
  legalName: "",
  registrationNumber: "",
  contactEmail: "",
  contactAddress: "",
  accurate: false,
};

function record(input: unknown): Record<string, unknown> | null {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : null;
}
function boundedText(value: unknown, maximum: number): string | null {
  if (typeof value !== "string" || value.length > maximum) return null;
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return null;
  return value.trim();
}
export function parseBusinessProfile(value: unknown): BusinessProfile | null {
  const input = record(value);
  if (
    !input ||
    Object.keys(input).some(
      (key) => !["name", "description", "locality"].includes(key),
    )
  )
    return null;
  const name = boundedText(input.name, 80);
  const description = boundedText(input.description, 1200);
  const locality = boundedText(input.locality, 100);
  if (
    name === null ||
    name.length < 2 ||
    description === null ||
    locality === null
  )
    return null;
  return { name, description, locality };
}
export function parseTraderDeclaration(
  value: unknown,
): TraderDeclaration | null {
  const input = record(value);
  if (
    !input ||
    Object.keys(input).some(
      (key) => !Object.keys(emptyDeclaration).includes(key),
    )
  )
    return null;
  const legalName = boundedText(input.legalName, 160);
  const registrationNumber = boundedText(input.registrationNumber, 40);
  const contactEmail = boundedText(input.contactEmail, 254);
  const contactAddress = boundedText(input.contactAddress, 500);
  if (
    input.country !== "BG" ||
    legalName === null ||
    registrationNumber === null ||
    contactEmail === null ||
    contactAddress === null ||
    typeof input.accurate !== "boolean" ||
    (contactEmail !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))
  )
    return null;
  return {
    country: "BG",
    legalName,
    registrationNumber,
    contactEmail,
    contactAddress,
    accurate: input.accurate,
  };
}
export function declarationSubmissionIssue(
  value: TraderDeclaration,
): keyof TraderDeclaration | null {
  if (value.legalName.trim().length < 2) return "legalName";
  if (value.registrationNumber.trim().length < 2) return "registrationNumber";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.contactEmail.trim()))
    return "contactEmail";
  if (value.contactAddress.trim().length < 5) return "contactAddress";
  if (!value.accurate) return "accurate";
  return null;
}
export function declarationComplete(value: TraderDeclaration) {
  return declarationSubmissionIssue(value) === null;
}
export function declarationReadiness(
  declaration: {
    status: DeclarationStatus;
    requirementVersion: number;
    country: string;
  } | null,
  requiredVersion = BUSINESS_SETUP_VERSION,
): DeclarationReadiness {
  if (!declaration || declaration.status === "draft") return "required";
  if (declaration.status === "rejected") return "rejected";
  if (
    declaration.country !== "BG" ||
    declaration.requirementVersion !== requiredVersion
  )
    return "stale";
  return declaration.status === "accepted" ? "current" : "review_required";
}
export function parseSetupStep(value: unknown): SetupStep | null {
  return SETUP_STEPS.includes(value as SetupStep) ? (value as SetupStep) : null;
}
export function validRevision(value: unknown): value is number {
  return (
    Number.isSafeInteger(value) &&
    (value as number) >= 0 &&
    (value as number) < 2147483647
  );
}
export function parseSignupIntent(value: unknown): SignupIntent | undefined {
  return value === null ||
    value === "buy" ||
    value === "personal" ||
    value === "business"
    ? value
    : undefined;
}
