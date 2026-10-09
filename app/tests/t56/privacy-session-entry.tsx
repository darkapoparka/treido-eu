import { createRoot } from "react-dom/client";
import { usePrivacy } from "../../apps/web/src/features/account-privacy/use-privacy";

function Fixture() {
  const controller = usePrivacy("human-A");
  return (
    <main>
      <p id="private-facts">{controller.view?.checkedAt ?? "concealed"}</p>
      <p id="pending">{JSON.stringify(controller.pending)}</p>
      <p id="acknowledgment">{JSON.stringify(controller.acknowledgment)}</p>
      <p id="error">{controller.code ?? "none"}</p>
      <button onClick={() => void controller.refresh()}>Refresh</button>
      <button onClick={() => void controller.execute({ kind: "review" })}>
        Review
      </button>
      <button onClick={() => void controller.execute()}>Retry exact</button>
      <button onClick={() => void controller.download("export-A")}>
        Download
      </button>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
