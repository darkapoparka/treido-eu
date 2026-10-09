import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { NextIntlClientProvider } from "next-intl";
import { ServiceSettingsForm } from "../../apps/web/src/features/seller-settings/form";
import { PersonalProfileForm } from "../../apps/web/src/features/seller-settings/personal-profile-form";
import type { ServiceView } from "../../apps/web/src/features/seller-settings/model";
import type { PersonalProfileView } from "../../apps/web/src/features/seller-settings/personal-profile-model";
import messages from "../../apps/web/src/features/seller-settings/messages.json";

const seller = "a0000000-0000-4000-8000-000000000001";
const personal =
  new URLSearchParams(location.search).get("fixture") === "profile";
let actorSubject = "synthetic-human-A";
let service: ServiceView = {
  sellerId: seller,
  name: "SERVER-INITIAL-PRIVATE",
  section: "contact",
  revision: 4,
  savedAt: null,
  payload: {
    published: false,
    publicEmail: "server-initial-private@example.test",
    publicPhone: "",
    contactNote: "SERVER-INITIAL-PRIVATE",
  },
};
let profile: PersonalProfileView = {
  sellerId: seller,
  revision: 4,
  profile: {
    name: "SERVER-INITIAL-PRIVATE",
    locality: "PRIVATE-LOCALITY",
    description: "PRIVATE-DESCRIPTION",
  },
};
function Fixture() {
  return (
    <NextIntlClientProvider
      locale="en"
      messages={{ sellerSettings: messages.en }}
      timeZone="UTC"
    >
      {personal ? (
        <PersonalProfileForm
          initial={profile}
          actorSubject={actorSubject}
          language="en"
        />
      ) : (
        <ServiceSettingsForm
          initial={service}
          actorSubject={actorSubject}
          language="en"
        />
      )}
    </NextIntlClientProvider>
  );
}
const root = createRoot(document.getElementById("root")!);
const render = () => root.render(<Fixture />);
Object.assign(window, {
  __replaceInitial: (sellerId = seller) => {
    service = { ...service, sellerId };
    profile = { ...profile, sellerId };
    flushSync(render);
  },
  __replaceActor: (subject: string) => {
    actorSubject = subject;
    flushSync(render);
  },
  __unmount: () => root.unmount(),
});
render();
