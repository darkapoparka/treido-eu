import type { Metadata } from "next";
import { localeSchema } from "@treido/contracts";
import "./globals.css";
import "@/features/account/account.css";
import "@/features/account/profile.css";
import "@/features/account/settings.css";
import "@/features/account/live-onboarding.css";
import "@/features/commerce/continuation.css";
import "@/features/commerce/checkout-parity.css";
import "@/features/discovery/live-shop.css";
import { AccountProvider } from "@/features/account/state";
import {
  liveGuestAccount,
  liveGuestDiscovery,
} from "@/features/catalog/reference/live-guest-seed";
import { DiscoveryProvider } from "@/features/discovery/state";
import { readReferenceScenario } from "@/features/catalog/reference/scenario.server";
export const metadata: Metadata = {
  title: "Shop reference preview",
  description:
    "Isolated discovery reference preview. No live commerce services.",
  robots: { index: false, follow: false },
  icons: { icon: "data:," },
};
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const scenario = await readReferenceScenario();
  return (
    <html
      lang={localeSchema.parse("en")}
      data-reference-scenario={scenario?.name ?? "live-android"}
    >
      <body>
        <DiscoveryProvider
          initial={scenario ? scenario.discovery : liveGuestDiscovery}
        >
          <AccountProvider
            initial={scenario ? scenario.account : liveGuestAccount}
          >
            {children}
          </AccountProvider>
        </DiscoveryProvider>
      </body>
    </html>
  );
}
