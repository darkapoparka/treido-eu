import { createRoot } from "react-dom/client";
import { useParams } from "next/navigation";
import { WorkspaceSession } from "../../apps/web/src/features/sellers/workspace-session";
import type { WorkspaceSellerAccess } from "../../apps/web/src/features/sellers/workspace-access";

function Fixture({
  sellerAccess,
  serverFrame,
}: {
  sellerAccess: WorkspaceSellerAccess[];
  serverFrame: string;
}) {
  const params = useParams();
  return (
    <WorkspaceSession
      actorSubject="human-A"
      sellerAccess={sellerAccess}
      serverFrame={serverFrame}
    >
      <main>
        <p id="private-facts">{params.sellerId ?? "human"}-private</p>
        <button type="button">Private command</button>
        {sellerAccess
          .find((seller) => seller.sellerId === params.sellerId)
          ?.capabilities.includes("declaration.manage") && (
          <p id="optional-facts">Private declaration reason</p>
        )}
        <p id="shell-sellers">
          {sellerAccess.map((seller) => seller.sellerId).join(",")}
        </p>
      </main>
    </WorkspaceSession>
  );
}

const root = createRoot(document.getElementById("root")!);
let frame = 0;
const fixture = window as typeof window & {
  __serverSnapshot: WorkspaceSellerAccess[];
  __autoRefresh: boolean;
};
fixture.__serverSnapshot = ["business-A", "business-B"].map((sellerId) => ({
  sellerId,
  capabilities: [
    "seller.read",
    "team.manage",
    "declaration.manage",
    "listing.read",
  ],
}));
fixture.__autoRefresh = true;
const renderFrame = () =>
  root.render(
    <Fixture
      sellerAccess={fixture.__serverSnapshot}
      serverFrame={"synthetic-frame-" + ++frame}
    />,
  );
Object.assign(window, {
  __unmount: () => root.unmount(),
  __renderFrame: renderFrame,
  __serverRefresh: () => {
    if (fixture.__autoRefresh) renderFrame();
  },
});
renderFrame();
