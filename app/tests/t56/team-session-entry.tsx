import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { NextIntlClientProvider } from "next-intl";
import { Team } from "../../apps/web/src/features/team/team";
import type { TeamView } from "../../apps/web/src/features/team/model";
import messages from "../../apps/web/src/features/team/messages.json";

const seller = "a0000000-0000-4000-8000-000000000001";
let actorSubject = "synthetic-human-A";
let initial: TeamView = {
  sellerId: seller,
  name: "SERVER-INITIAL-PRIVATE",
  revision: 4,
  seats: 10,
  usedSeats: 1,
  reservedSeats: 1,
  managerDefaults: ["seller.read", "listing.read"],
  delegable: ["seller.read", "listing.read", "inbox.read"],
  canInviteManager: true,
  members: [],
  invitations: [],
};
function Fixture() {
  return (
    <NextIntlClientProvider
      locale="en"
      messages={{ team: messages.en }}
      timeZone="UTC"
    >
      <Team initial={initial} actorSubject={actorSubject} language="en" />
    </NextIntlClientProvider>
  );
}
const root = createRoot(document.getElementById("root")!);
const render = () => root.render(<Fixture />);
Object.assign(window, {
  __replaceInitial: (
    sellerId = seller,
    marker = "REPLACED-INITIAL-PRIVATE",
  ) => {
    initial = { ...initial, sellerId, name: marker };
    flushSync(render);
  },
  __replaceActor: (subject: string) => {
    actorSubject = subject;
    flushSync(render);
  },
  __unmount: () => root.unmount(),
});
render();
