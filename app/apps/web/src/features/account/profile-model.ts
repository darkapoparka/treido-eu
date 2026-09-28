import type { Profile } from "./state";

export type ProfileTextDraft = Partial<Pick<Profile, "firstName" | "lastName">>;
// Only fields changed by this editor are written. A stale name form must not
// overwrite a newly selected avatar, size or skin preference from another owner.
export function profileTextPatch(draft: ProfileTextDraft): ProfileTextDraft {
  return {
    ...(draft.firstName !== undefined
      ? { firstName: draft.firstName.trim() }
      : {}),
    ...(draft.lastName !== undefined
      ? { lastName: draft.lastName.trim() }
      : {}),
  };
}
export function displayBirthday(value: string): string {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return date ? `${date[2]}/${date[3]}/${date[1]}` : value;
}
export function compactProfileEmail(value: string): string {
  const at = value.lastIndexOf("@");
  if (at < 1 || value.length <= 24) return value;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  return `${local.slice(0, 10)}...${local.slice(-1)}@${domain}`;
}
export function birthdayInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)]
    .filter(Boolean)
    .join("/");
}
export function birthdayValue(value: string): string | null {
  if (!value.trim()) return "";
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  return match ? `${match[3]}-${match[1]}-${match[2]}` : null;
}
export function withoutPersonPreferences(
  choices: Record<string, string[]>,
  id: string,
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(choices).filter(([key]) => !key.startsWith(`${id}:`)),
  );
}
