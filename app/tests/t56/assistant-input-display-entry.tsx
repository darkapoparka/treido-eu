import { createRoot } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import { AssistantInterpretInput } from "../../apps/web/src/features/assistant-runs/interpreted-intent";
import { parseToolIntent } from "../../apps/web/src/features/shopping-tools/intent";
import type { InputMode } from "../../apps/web/src/features/assistant-runs/model";
import s from "../../apps/web/src/features/photo-match/photo.module.css";
import discoveryUI from "../../apps/web/src/features/locale/discoveryUI-messages.json";

// Actual input, controller, command parser and feature CSS in a minimal host.
// Synthetic identity/action responses do not qualify provider or native parity.
const params = new URLSearchParams(window.location.search),
  locale = params.get("lang") === "bg" ? "bg" : "en",
  mode = (params.get("mode") ?? "text") as InputMode,
  initial = parseToolIntent(
    "q=synthetic&category=cat%3Aelectronics&seller=personal&lang=" + locale,
    "find-for-me",
  ),
  root = createRoot(document.getElementById("root")!);

root.render(
  <NextIntlClientProvider
    locale={locale}
    messages={{ discoveryUI: discoveryUI[locale] }}
    timeZone="UTC"
  >
    <main className={s.content}>
      <AssistantInterpretInput initial={initial} locale={locale} mode={mode} />
    </main>
  </NextIntlClientProvider>,
);
Object.assign(window, { __unmount: () => root.unmount() });
