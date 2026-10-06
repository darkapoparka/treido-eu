import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { useUser } from "@clerk/nextjs";
import { MediaPicker } from "../apps/web/src/features/selling/media-picker";

type Scope = { sellerId: string; draftId: string; actorSubject: string };
declare global {
  interface Window {
    __mediaScope: (scope: Scope) => void;
  }
}
function Fixture() {
  // Parent subscription deliberately rerenders the picker even when the stable
  // Clerk object is unchanged, matching hydration of the real draft editor.
  useUser();
  const [scope, setScope] = useState<Scope>({
    sellerId: "seller-A",
    draftId: "draft-A",
    actorSubject: "A",
  });
  window.__mediaScope = (next) => flushSync(() => setScope(next));
  return (
    <MediaPicker
      key={`${scope.sellerId}:${scope.draftId}:${scope.actorSubject}`}
      {...scope}
      language="en"
      canWrite
      available
    />
  );
}
createRoot(document.getElementById("root")!).render(
  React.createElement(Fixture),
);
