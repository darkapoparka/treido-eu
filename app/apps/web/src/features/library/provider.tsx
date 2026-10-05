"use client";
import {
  createContext,
  useContext,
  useState,
  Fragment,
  type ReactNode,
} from "react";
import { BuyerSessionBoundary } from "./session-boundary";
import type { LibraryQuery } from "./model";
import { useLibraryController, type LibraryController } from "./use-library";
import { LibraryFeedback } from "./feedback";
import { CollectionPicker } from "./collection-picker";
import "../discovery/saved.css";
const Context = createContext<
  (LibraryController & { openPicker: (listingId: string) => void }) | null
>(null);
export function LibraryProvider({
  query,
  children,
}: {
  query: Partial<LibraryQuery>;
  children: ReactNode;
}) {
  return (
    <BuyerSessionBoundary>
      <ScopedLibraryProvider query={query}>{children}</ScopedLibraryProvider>
    </BuyerSessionBoundary>
  );
}
function ScopedLibraryProvider({
  query,
  children,
}: {
  query: Partial<LibraryQuery>;
  children: ReactNode;
}) {
  const library = useLibraryController(query),
    [picker, setPicker] = useState<{ id: string; scope: string } | null>(null);
  return (
    <Context.Provider
      value={{
        ...library,
        openPicker: (id) => setPicker({ id, scope: library.scopeKey }),
      }}
    >
      <Fragment key={library.scopeKey}>{children}</Fragment>
      <LibraryFeedback controller={library} />
      {picker &&
        picker.scope === library.scopeKey &&
        library.status === "ready" && (
          <CollectionPicker
            key={library.scopeKey}
            listingId={picker.id}
            onClose={() => setPicker(null)}
          />
        )}
    </Context.Provider>
  );
}
export function useBuyerLibrary() {
  const value = useContext(Context);
  if (!value)
    throw new Error(
      "Buyer library controls require the real library provider.",
    );
  return value;
}
