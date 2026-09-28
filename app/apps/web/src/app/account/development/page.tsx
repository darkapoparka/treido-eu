import { readCatalog } from "@/features/catalog/queries.server";
import { AccountPage } from "@/features/account/forms";

export default async function Page() {
  await readCatalog();
  return (
    <AccountPage android className="android-development">
      <h1 className="sr-only">Development mode</h1>
      <button
        type="button"
        className="native-development-toggle"
        role="switch"
        aria-checked="false"
        aria-label="Shop Minis"
        disabled
      >
        <span>
          Shop Minis<small>Build your own Shop Mini.</small>
        </span>
        <span className="native-disabled-switch" aria-hidden="true" />
      </button>
    </AccountPage>
  );
}
