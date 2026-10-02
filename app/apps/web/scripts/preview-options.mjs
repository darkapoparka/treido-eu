/** The Treido preview owns loopback and one output directory, never the donor. */
export function previewOptions(env = process.env) {
  if (
    env.VERCEL ||
    env.VERCEL_ENV === "production" ||
    env.NODE_ENV === "production"
  ) {
    throw new Error(
      "The reference preview is local-only; refusing a hosted/production environment.",
    );
  }
  const rawPort = env.TREIDO_PREVIEW_PORT ?? "6418";
  if (!/^[1-9]\d{3,4}$/.test(rawPort)) {
    throw new Error(
      "TREIDO_PREVIEW_PORT must be an integer from 1024 to 65535.",
    );
  }
  const port = Number(rawPort);
  if (port < 1024 || port > 65535 || port === 6412) {
    throw new Error("Choose a non-privileged port other than donor port 6412.");
  }
  return {
    port,
    args: ["dev", "--hostname", "127.0.0.1", "--port", String(port)],
    env: {
      SHOP_REFERENCE_PREVIEW: "1",
      VERCEL_ENV: "preview",
      SHOP_PARITY_DIST_DIR: ".qa/treido-preview",
      SHOP_PARITY_TSCONFIG_PATH: "tsconfig.treido-preview.json",
    },
  };
}
