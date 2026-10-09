import { createRoot } from "react-dom/client";
import {
  ComparisonProvider,
  useComparison,
} from "../../apps/web/src/features/shopping-tools/comparison-provider";
import {
  SavedSearchProvider,
  useSavedSearches,
} from "../../apps/web/src/features/saved-searches/provider";

const resource = "a0000000-0000-4000-8000-000000000001";
function ComparisonProbe() {
  const state = useComparison();
  return (
    <section id="comparison">
      <p className="status">{state.status}</p>
      <p className="private">{state.view?.checkedAt ?? ""}</p>
      <p className="pending">{String(state.pending)}</p>
      <p className="busy">{String(state.busy)}</p>
      <p className="feedback">{state.feedback ?? ""}</p>
      <p className="ack">{JSON.stringify(state.acknowledgment)}</p>
      <button onClick={() => void state.reload()}>Refresh comparison</button>
      <button
        onClick={() =>
          void state.execute({ kind: "remove", selectionId: resource })
        }
      >
        Change comparison
      </button>
      <button onClick={() => void state.retry()}>Retry comparison</button>
    </section>
  );
}
function SearchProbe() {
  const state = useSavedSearches();
  return (
    <section id="search">
      <p className="status">{state.status}</p>
      <p className="private">{state.view?.checkedAt ?? ""}</p>
      <p className="pending">{String(state.pending)}</p>
      <p className="busy">{String(state.busy)}</p>
      <p className="feedback">{state.feedback ?? ""}</p>
      <p className="ack">{JSON.stringify(state.ack)}</p>
      <button onClick={() => void state.reload()}>Refresh search</button>
      <button
        onClick={() =>
          void state.execute({ kind: "pause", searchId: resource })
        }
      >
        Change search
      </button>
      <button onClick={() => void state.retry()}>Retry search</button>
    </section>
  );
}
function Fixture() {
  return (
    <ComparisonProvider>
      <SavedSearchProvider>
        <label>
          Public keyword
          <input id="public-keyword" defaultValue="" />
        </label>
        <ComparisonProbe />
        <SearchProbe />
      </SavedSearchProvider>
    </ComparisonProvider>
  );
}
const root = createRoot(document.getElementById("root")!);
const render = () => root.render(<Fixture />);
Object.assign(window, { __unmount: () => root.unmount(), __rerender: render });
render();
