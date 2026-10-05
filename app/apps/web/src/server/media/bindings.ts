export type MediaBindings = {
  provider?: "r2" | "neon";
  region?: string;
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
  if (env.TREIDO_MEDIA_PROVIDER === "neon")
    return validateNeonMediaBindings(env);
  if (env.TREIDO_MEDIA_PROVIDER && env.TREIDO_MEDIA_PROVIDER !== "r2")
    return { ok: false, variables: ["TREIDO_MEDIA_PROVIDER"] };
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

/** Bind the existing private bucket to the declared Neon branch, never an arbitrary S3 host. */
export function validateNeonMediaBindings(
  env: Readonly<Record<string, string | undefined>>,
): { ok: true; bindings: MediaBindings } | { ok: false; variables: string[] } {
  const get = (key: string) => env[key] ?? "",
    invalid = new Set<string>();
  for (const key of [
    "TREIDO_MEDIA_BUCKET",
    "TREIDO_MEDIA_PREFIX",
    "TREIDO_MEDIA_PURPOSE",
    "AWS_ENDPOINT_URL_S3",
    "AWS_REGION",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "TREIDO_APP_ORIGIN",
    "TREIDO_NEON_BRANCH_ID",
  ])
    if (!get(key)) invalid.add(key);
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(get("TREIDO_MEDIA_BUCKET")))
    invalid.add("TREIDO_MEDIA_BUCKET");
  if (
    !/^[a-z][a-z0-9-]{1,40}\/$/.test(get("TREIDO_MEDIA_PREFIX")) ||
    (get("TREIDO_ENV") !== "production" &&
      !get("TREIDO_MEDIA_PREFIX").startsWith(get("TREIDO_ENV") + "-"))
  )
    invalid.add("TREIDO_MEDIA_PREFIX");
  if (
    !["development", "test", "preview", "production"].includes(
      get("TREIDO_ENV"),
    ) ||
    get("TREIDO_MEDIA_PURPOSE") !== get("TREIDO_ENV")
  )
    invalid.add("TREIDO_MEDIA_PURPOSE");
  const region = get("AWS_REGION"),
    branch = get("TREIDO_NEON_BRANCH_ID");
  if (
    !/^eu-(central|west|north)-[1-3]$/.test(region) ||
    get("TREIDO_DB_REGION").replace(/^aws-/, "") !== region
  )
    invalid.add("AWS_REGION");
  if (!/^br-[a-z0-9-]{1,60}$/.test(branch))
    invalid.add("TREIDO_NEON_BRANCH_ID");
  try {
    const endpoint = new URL(get("AWS_ENDPOINT_URL_S3"));
    const expectedPrefix = branch + ".storage.c-";
    const suffix = "." + region + ".aws.neon.tech";
    const cell = endpoint.hostname.slice(expectedPrefix.length, -suffix.length);
    if (
      endpoint.protocol !== "https:" ||
      endpoint.origin !== get("AWS_ENDPOINT_URL_S3") ||
      endpoint.username ||
      endpoint.password ||
      !endpoint.hostname.startsWith(expectedPrefix) ||
      !endpoint.hostname.endsWith(suffix) ||
      !/^\d+$/.test(cell)
    )
      invalid.add("AWS_ENDPOINT_URL_S3");
  } catch {
    invalid.add("AWS_ENDPOINT_URL_S3");
  }
  if (!/^nak_live_[A-Za-z0-9_-]{16,128}$/.test(get("AWS_ACCESS_KEY_ID")))
    invalid.add("AWS_ACCESS_KEY_ID");
  if (!/^nsk_live_[A-Za-z0-9_-]{16,256}$/.test(get("AWS_SECRET_ACCESS_KEY")))
    invalid.add("AWS_SECRET_ACCESS_KEY");
  try {
    if (new URL(get("TREIDO_APP_ORIGIN")).origin !== get("TREIDO_APP_ORIGIN"))
      invalid.add("TREIDO_APP_ORIGIN");
  } catch {
    invalid.add("TREIDO_APP_ORIGIN");
  }
  for (const key of Object.keys(env))
    if (/^NEXT_PUBLIC_.*(?:R2|STORAGE|UPLOAD|AWS_)/.test(key) && get(key))
      invalid.add(key);
  return invalid.size
    ? { ok: false, variables: [...invalid] }
    : {
        ok: true,
        bindings: {
          provider: "neon",
          region,
          accountId: "",
          bucket: get("TREIDO_MEDIA_BUCKET"),
          prefix: get("TREIDO_MEDIA_PREFIX"),
          endpoint: get("AWS_ENDPOINT_URL_S3"),
          purpose: get("TREIDO_MEDIA_PURPOSE"),
          origin: get("TREIDO_APP_ORIGIN"),
        },
      };
}
