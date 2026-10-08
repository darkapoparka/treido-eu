import { getTranslations } from "next-intl/server";
import { readBuyerReferenceCatalog as readCatalog } from "@/features/catalog/buyer-data-mode.server";
import { AccountPage } from "@/features/account/forms";

export default async function Page() {
  const ui = await getTranslations("accountUI");
  await readCatalog();
  return (
    <AccountPage android className="android-development">
      <h1 className="sr-only">{ui("developmentMode")}</h1>
      <button
        type="button"
        className="native-development-toggle"
        role="switch"
        aria-checked="false"
        aria-label="Shop Minis"
        disabled
      >
        <span>
          Shop Minis<small>{ui("buildYourOwnShopMini")}</small>
        </span>
        <span className="native-disabled-switch" aria-hidden="true" />
      </button>
    </AccountPage>
  );
}
