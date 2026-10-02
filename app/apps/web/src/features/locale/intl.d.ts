import type { messages } from "./messages";
import type studio from "../sellers/preview/studio-messages.json";
import type merchantUI from "./merchantUI-messages.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: "bg" | "en";
    Messages: typeof messages.en &
      typeof studio.en & { merchantUI: typeof merchantUI.en };
  }
}
