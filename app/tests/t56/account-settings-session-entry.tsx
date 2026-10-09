import { createRoot } from "react-dom/client";
import { useSearchParams } from "next/navigation";
import { useAccountSettings } from "../../apps/web/src/features/account-closure/use-settings";
import type { SettingsMode } from "../../apps/web/src/features/account-closure/actions";

/** Synthetic controls exercise the real hook; no production auth or visual baseline. */
function Fixture({ nonce }: { nonce: number }) {
  const params = useSearchParams(),
    mode = (params.get("mode") ?? "preferences") as SettingsMode;
  const state = useAccountSettings("synthetic-human-A", mode);
  const fixture = window as typeof window & { __renders?: unknown[] };
  fixture.__renders ??= [];
  fixture.__renders.push({
    nonce,
    ready: state.ready,
    pending: state.pending,
    error: state.error,
    busy: state.busy,
    view: state.view,
  });
  Object.assign(window, { __settings: state });
  return (
    <main>
      <p id="private-facts">{state.view ? JSON.stringify(state.view) : ""}</p>
      <p id="ready">{String(state.ready)}</p>
      <p id="busy">{String(state.busy)}</p>
      <p id="error">{state.error ?? ""}</p>
      <p id="pending">{state.pending?.requestId ?? ""}</p>
      <button onClick={() => void state.refresh(true)}>
        Check current account
      </button>
      <button
        disabled={!state.ready || state.busy || !!state.pending}
        onClick={() =>
          state.execute({
            kind: "preferences",
            locale: "bg",
            browseScope: "business",
          })
        }
      >
        Save preferences
      </button>
      <button
        disabled={!state.ready || state.busy || !!state.pending}
        onClick={() =>
          state.execute({
            kind: "revokeSession",
            sessionRef: "b".repeat(64),
            acknowledged: true,
          })
        }
      >
        End synthetic session
      </button>
      <button
        disabled={!state.ready || state.busy || !state.pending}
        onClick={state.retry}
      >
        Retry original request
      </button>
      <button
        disabled={!state.ready || state.busy || !state.pending}
        onClick={state.recover}
      >
        Recover original request
      </button>
      <button
        disabled={!state.ready || state.busy}
        onClick={() => void state.checkSession("synthetic-effect")}
      >
        Check synthetic revocation
      </button>
    </main>
  );
}
const root = createRoot(document.getElementById("root")!);
let nonce = 0;
const render = () => root.render(<Fixture nonce={++nonce} />);
Object.assign(window, { __unmount: () => root.unmount(), __rerender: render });
render();
