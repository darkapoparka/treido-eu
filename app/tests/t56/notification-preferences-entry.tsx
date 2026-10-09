import { createRoot } from "react-dom/client";
import { NotificationPreferencesPanel } from "../../apps/web/src/features/notification-delivery/preferences-panel";

let language: "bg" | "en" =
  new URLSearchParams(location.search).get("lang") === "bg" ? "bg" : "en";
const root = createRoot(document.getElementById("root")!);
const render = () =>
  root.render(
    <NotificationPreferencesPanel
      language={language}
      state="ready"
      actorSubject="human-A"
    />,
  );
// Synthetic routing commits new language props without remounting the actor's panel.
Object.assign(window, {
  __setLanguage: (next: "bg" | "en") => {
    language = next;
    history.replaceState(null, "", "?lang=" + language);
    render();
  },
});
render();
