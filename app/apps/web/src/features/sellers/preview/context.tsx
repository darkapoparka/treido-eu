"use client";
import { createTranslator } from "next-intl";
import merchantUI from "../../locale/merchantUI-messages.json";
import captions from "../../locale/caption-messages.json";
import { NextIntlClientProvider } from "next-intl";
import studioMessages from "./studio-messages.json";
import { parseTimeZone } from "../../locale/regions";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import {
  initialPreviewState,
  readPreviewState,
  type PreviewState,
  type StoreState,
} from "./model";
import { previewHref } from "./routes";

const storageKey = "treido-admin-frontend-preview-v1";
const textSizeKey = `${storageKey}-large-text`;
type PreviewContext = {
  store: StoreState;
  storeId: "studio" | "personal";
  language: "en" | "bg";
  href: (section?: string) => string;
  text: (en: string, bg?: string) => string;
  update: (change: Partial<StoreState>) => void;
  reset: (demo: boolean) => void;
  notify: (message: string) => void;
  notice: string;
  ready: boolean;
  largeText: boolean;
  setLargeText: (value: boolean) => void;
};
const Context = createContext<PreviewContext | null>(null);
export function PreviewProvider({
  children,
  storeId,
  language,
}: {
  children: ReactNode;
  storeId: "studio" | "personal";
  language: "en" | "bg";
}) {
  const ui = useMemo(
    () =>
      createTranslator({
        locale: language,
        messages: { merchantUI: merchantUI[language] },
        namespace: "merchantUI",
      }),
    [language],
  );
  const [state, setState] = useState<PreviewState>(() => initialPreviewState());
  const [ready, setReady] = useState(false);
  const [notice, notify] = useState("");
  const [largeText, setLargeTextState] = useState(false);
  useEffect(() => {
    const recover = () => {
      try {
        const raw = localStorage.getItem(storageKey);
        setLargeTextState(localStorage.getItem(textSizeKey) === "1");
        const saved = readPreviewState(raw);
        if (saved) setState(saved);
        else if (raw) notify(ui("theSavedPreviewCouldNotBeReadAnEmptyPreview"));
      } catch {
        notify(
          ui("browserStorageIsUnavailablePreviewChangesWillLastOnlyWhile"),
        );
      }
      setReady(true);
    };
    recover();
  }, [ui]);
  const persist = (next: PreviewState) => {
    setState(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      notify(ui("browserStorageIsFullOrUnavailableThisPreviewChangeIs"));
    }
  };
  const setLargeText = (value: boolean) => {
    setLargeTextState(value);
    try {
      localStorage.setItem(textSizeKey, value ? "1" : "0");
    } catch {
      // A reviewer preference can still be used for the mounted page.
    }
  };
  const update = (change: Partial<StoreState>) => {
    persist({
      ...state,
      stores: {
        ...state.stores,
        [storeId]: { ...state.stores[storeId], ...change },
      },
    });
  };
  return (
    <NextIntlClientProvider
      locale={language}
      messages={{
        ...studioMessages[language],
        merchantUI: merchantUI[language],
        captions: captions[language],
      }}
      timeZone={parseTimeZone(state.stores[storeId].settings.timezone) ?? "UTC"}
    >
      <Context.Provider
        value={{
          store: state.stores[storeId],
          storeId,
          language,
          ready,
          largeText,
          setLargeText,
          notice,
          notify,
          href: (section) => previewHref(section, language, storeId),
          text: (en, bg) => (language === "bg" && bg ? bg : en),
          update,
          reset: (demo) => {
            persist(initialPreviewState(demo));
            notify(
              demo
                ? ui("exampleStoreLoadedAllDataIsSynthetic")
                : ui("previewResetToAnEmptyStore"),
            );
          },
        }}
      >
        {children}
      </Context.Provider>
    </NextIntlClientProvider>
  );
}
export function usePreview() {
  const context = useContext(Context);
  if (!context) throw new Error("Merchant preview context required");
  return context;
}
