export type MediaBindings = {
  accountId: string;
  bucket: string;
  prefix: string;
  endpoint: string;
  origin: string;
  purpose: string;
};
export function validateMediaBindings(
  env: Readonly<Record<string, string | undefined>>,
): { ok: true; bindings: MediaBindings } | { ok: false; variables: string[] } {
  const invalid = new Set<string>();
  const get = (key: string) => env[key] ?? "";
  for (const key of [
    "TREIDO_R2_ACCOUNT_ID",
    "TREIDO_R2_BUCKET",
    "TREIDO_R2_PREFIX",
    "TREIDO_R2_JURISDICTION",
    "TREIDO_R2_PURPOSE",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "TREIDO_APP_ORIGIN",
  ])
    if (!get(key)) invalid.add(key);
  if (!/^[a-f0-9]{32}$/.test(get("TREIDO_R2_ACCOUNT_ID")))
    invalid.add("TREIDO_R2_ACCOUNT_ID");
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(get("TREIDO_R2_BUCKET")))
    invalid.add("TREIDO_R2_BUCKET");
  if (!/^[a-z][a-z0-9-]{1,40}\/$/.test(get("TREIDO_R2_PREFIX")))
    invalid.add("TREIDO_R2_PREFIX");
  if (get("TREIDO_R2_JURISDICTION") !== "eu")
    invalid.add("TREIDO_R2_JURISDICTION");
  if (
    get("TREIDO_R2_PURPOSE") !== get("TREIDO_ENV") ||
    !["development", "test", "preview", "production"].includes(
      get("TREIDO_ENV"),
    )
  )
    invalid.add("TREIDO_R2_PURPOSE");
  if (
    get("TREIDO_ENV") !== "production" &&
    !get("TREIDO_R2_PREFIX").startsWith(`${get("TREIDO_ENV")}-`)
  )
    invalid.add("TREIDO_R2_PREFIX");
  if (!/^[a-f0-9]{32}$/.test(get("R2_ACCESS_KEY_ID")))
    invalid.add("R2_ACCESS_KEY_ID");
  if (!/^[a-f0-9]{64}$/.test(get("R2_SECRET_ACCESS_KEY")))
    invalid.add("R2_SECRET_ACCESS_KEY");
  for (const key of Object.keys(env))
    if (/^NEXT_PUBLIC_.*(?:R2|STORAGE|UPLOAD)/.test(key) && get(key))
      invalid.add(key);
  try {
    if (new URL(get("TREIDO_APP_ORIGIN")).origin !== get("TREIDO_APP_ORIGIN"))
      invalid.add("TREIDO_APP_ORIGIN");
  } catch {
    invalid.add("TREIDO_APP_ORIGIN");
  }
  return invalid.size
    ? { ok: false, variables: [...invalid] }
    : {
        ok: true,
        bindings: {
          accountId: get("TREIDO_R2_ACCOUNT_ID"),
          bucket: get("TREIDO_R2_BUCKET"),
          prefix: get("TREIDO_R2_PREFIX"),
          purpose: get("TREIDO_R2_PURPOSE"),
          origin: get("TREIDO_APP_ORIGIN"),
          endpoint: `https://${get("TREIDO_R2_ACCOUNT_ID")}.eu.r2.cloudflarestorage.com`,
        },
      };
}
