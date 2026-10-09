import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { NextIntlClientProvider } from "next-intl";
import { CatalogueImportDetail } from "../../apps/web/src/features/catalogue-import/detail";
import type { ImportView } from "../../apps/web/src/features/catalogue-import/model";
import messages from "../../apps/web/src/features/catalogue-import/messages.json";

const sellerId = "a0000000-0000-4000-8000-000000000001";
let actorSubject = "synthetic-human-A";
let initial: ImportView = {
  id: "a0000000-0000-4000-8000-000000000002",
  sellerId,
  name: "SERVER-INITIAL-PRIVATE.csv",
  state: "review",
  revision: 4,
  total: 1,
  created: 0,
  ready: 1,
  invalid: 0,
  selected: 1,
  error: null,
  createdAt: "2026-10-10T00:00:00.000Z",
  after: 0,
  nextAfter: null,
  rowLimit: 1000,
  draftsRemaining: 10,
  canManage: true,
  uploaded: [0],
  sourceBytes: 100,
  sourceHash: "a".repeat(64),
  rows: [
    {
      number: 1,
      externalId: "PRIVATE-EXTERNAL",
      raw: { title: "PRIVATE-ROW", price: "129.50" },
      payload: null,
      inventory: null,
      errors: [],
      selected: true,
      state: "ready",
      listingId: null,
    },
  ],
};
const root = createRoot(document.getElementById("root")!);
function Fixture() {
  return (
    <NextIntlClientProvider
      locale="en"
      messages={{ catalogueImport: messages.en }}
      timeZone="UTC"
    >
      <CatalogueImportDetail initial={initial} actorSubject={actorSubject} />
    </NextIntlClientProvider>
  );
}
const render = () => root.render(<Fixture />);
Object.assign(window, {
  __replaceInitial: (updates: Partial<ImportView> = {}) => {
    initial = { ...initial, ...updates };
    flushSync(render);
  },
  __replaceActor: (subject: string) => {
    actorSubject = subject;
    flushSync(render);
  },
  __unmount: () => root.unmount(),
});
render();
