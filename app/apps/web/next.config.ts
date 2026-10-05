import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
const nextConfig: NextConfig = {
  transpilePackages: ["@treido/contracts"],
  // Inngest loads its OpenTelemetry peer at runtime. Externalizing the SDK lets
  // Node resolve the pnpm link without Turbopack rejecting the workspace link.
  serverExternalPackages: ["inngest"],
  devIndicators: false,
  // Keep audit type generation away from the running preview's protected config.
  // Production checks use fresh route types, not stale dev/audit output.
  // Compiler strictness is inherited unchanged from the existing tsconfig.
  ...(process.env.SHOP_PARITY_TSCONFIG_PATH
    ? { typescript: { tsconfigPath: process.env.SHOP_PARITY_TSCONFIG_PATH } }
    : process.env.NODE_ENV === "production"
      ? { typescript: { tsconfigPath: "tsconfig.build.json" } }
      : {}),
  // Explicit output isolation keeps production verification separate from the
  // running preview. The current 6412 preview owns .qa/shelves-dev, not .next.
  ...(process.env.SHOP_PARITY_DIST_DIR
    ? { distDir: process.env.SHOP_PARITY_DIST_DIR }
    : {}),
};
const withNextIntl = createNextIntlPlugin(
  "./src/features/locale/intl-request.ts",
);
export default withNextIntl(nextConfig);
