import { ShopSurface } from "./hydration-boundary";
import { FloatingNav } from "./components";

export function HomeLoading() {
  return (
    <ShopSurface
      className="shop-page home-page home-loading"
      aria-busy="true"
      aria-label="Loading home"
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
