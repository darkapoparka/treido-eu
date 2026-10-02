import { useTranslations } from "next-intl";
import { ShopSurface } from "./hydration-boundary";
import { FloatingNav } from "./components";

export function HomeLoading() {
  const ui = useTranslations("discoveryUI");
  return (
    <ShopSurface
      className="shop-page home-page home-loading"
      aria-busy="true"
      aria-label={ui("loadingHome")}
      data-ui-label="loadingHome"
    >
      <div className="home-shortcuts" aria-hidden="true">
        <i />
        <i />
        <b />
        <b />
        <b />
      </div>
      <div className="home-loading-deliveries" aria-hidden="true">
        <i />
        <i />
      </div>
      <div className="home-loading-campaign" aria-hidden="true" />
      <FloatingNav fade />
    </ShopSurface>
  );
}
