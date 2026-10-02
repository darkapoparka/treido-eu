export type JobBindings = {
  applicationId: string;
  environment: string;
  origin: string;
  repairServiceId: string;
};
export function validateJobBindings(
  env: Readonly<Record<string, string | undefined>>,
): { ok: true; bindings: JobBindings } | { ok: false; missing: string[] } {
  const missing = new Set<string>();
  const read = (key: string) => env[key] ?? "";
  for (const key of [
    "TREIDO_INNGEST_APP_ID",
    "INNGEST_ENV",
    "INNGEST_EVENT_KEY",
    "INNGEST_SIGNING_KEY",
    "TREIDO_OUTBOX_SERVICE_ID",
    "CRON_SECRET",
    "TREIDO_APP_ORIGIN",
  ])
    if (!read(key)) missing.add(key);
  for (const key of [
    "TREIDO_INNGEST_APP_ID",
    "INNGEST_ENV",
    "TREIDO_OUTBOX_SERVICE_ID",
  ])
    if (!/^[a-z][a-z0-9-]{1,79}$/.test(read(key))) missing.add(key);
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(read("INNGEST_ENV")))
    missing.add("INNGEST_ENV");
  if (read("TREIDO_INNGEST_PURPOSE") !== read("TREIDO_ENV"))
    missing.add("TREIDO_INNGEST_PURPOSE");
  const production = read("TREIDO_ENV") === "production";
  if (!/^signkey-[a-z]+-[a-f0-9]{64}$/.test(read("INNGEST_SIGNING_KEY")))
    missing.add("INNGEST_SIGNING_KEY");
  if (read("INNGEST_DEV") && !["false", "0"].includes(read("INNGEST_DEV")))
    missing.add("INNGEST_DEV");
  for (const key of [
    "INNGEST_BASE_URL",
    "INNGEST_API_BASE_URL",
    "INNGEST_EVENT_API_BASE_URL",
    "INNGEST_SERVE_PATH",
  ])
    if (read(key)) missing.add(key);
  if (!/^[A-Za-z0-9_-]{20,512}$/.test(read("INNGEST_EVENT_KEY")))
    missing.add("INNGEST_EVENT_KEY");
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(read("CRON_SECRET")))
    missing.add("CRON_SECRET");
  if (
    read("TREIDO_OUTBOX_REDRIVE_SECRET") &&
    (!/^[A-Za-z0-9_-]{32,256}$/.test(read("TREIDO_OUTBOX_REDRIVE_SECRET")) ||
      read("TREIDO_OUTBOX_REDRIVE_SECRET") === read("CRON_SECRET"))
  )
    missing.add("TREIDO_OUTBOX_REDRIVE_SECRET");
  for (const key of Object.keys(env))
    if (/^NEXT_PUBLIC_.*(?:INNGEST|OUTBOX|CRON)/.test(key) && read(key))
      missing.add(key);
  try {
    const url = new URL(read("TREIDO_APP_ORIGIN"));
    if (
      url.origin !== read("TREIDO_APP_ORIGIN") ||
      url.username ||
      url.password ||
      (production || read("TREIDO_ENV") === "preview"
        ? url.protocol !== "https:"
        : !["development", "test"].includes(read("TREIDO_ENV")) ||
          url.protocol !== "http:" ||
          url.hostname !== "127.0.0.1")
    )
      missing.add("TREIDO_APP_ORIGIN");
  } catch {
    missing.add("TREIDO_APP_ORIGIN");
  }
  // Signed cloud execution cannot call the loopback browser origin. A reviewed
  // development tunnel supplies only the callback origin; API hosts stay fixed.
  const callbackOrigin =
    read("INNGEST_SERVE_ORIGIN") || read("TREIDO_APP_ORIGIN");
  try {
    const callback = new URL(callbackOrigin);
    const hostname = callback.hostname;
    if (
      callback.protocol !== "https:" ||
      callback.origin !== callbackOrigin ||
      callback.username ||
      callback.password ||
      !hostname.includes(".") ||
      hostname.includes(":") ||
      /^[\d.]+$/.test(hostname) ||
      /(?:^|\.)(?:localhost|local|internal|invalid|test)$/.test(hostname) ||
      (["production", "preview"].includes(read("TREIDO_ENV")) &&
        callbackOrigin !== read("TREIDO_APP_ORIGIN"))
    )
      missing.add("INNGEST_SERVE_ORIGIN");
  } catch {
    missing.add("INNGEST_SERVE_ORIGIN");
  }
  return missing.size
    ? { ok: false, missing: [...missing] }
    : {
        ok: true,
        bindings: {
          applicationId: read("TREIDO_INNGEST_APP_ID"),
          environment: read("INNGEST_ENV"),
          origin: callbackOrigin,
          repairServiceId: read("TREIDO_OUTBOX_SERVICE_ID"),
        },
      };
}
