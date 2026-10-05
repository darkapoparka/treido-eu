"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
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
  const library = useLibraryController(query),
    [picker, setPicker] = useState<string | null>(null);
  return (
    <Context.Provider value={{ ...library, openPicker: setPicker }}>
      {children}
      <LibraryFeedback controller={library} />
      {picker && (
        <CollectionPicker listingId={picker} onClose={() => setPicker(null)} />
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
