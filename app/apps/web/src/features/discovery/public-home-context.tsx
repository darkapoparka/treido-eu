"use client";
import { useTranslations } from "next-intl";
import { getBrowseCategory } from "@treido/contracts/categories";
import {
  discoverySearchParams,
  type DiscoveryInput,
} from "../catalog/discovery-input";
import { discoveryDockDestination } from "./browse-scope-route";
import { marketplaceHref } from "./marketplace-navigation";
import { SourceLink } from "./return-navigation";
import { Icon } from "./icons";

/** Direct filtered Home links remain useful, with an explicit way out. */
export function PublicHomeContext({ input }: { input: DiscoveryInput }) {
  const t = useTranslations("marketplace");
  const filtered = !!(
    input.q ||
    input.category ||
    input.condition ||
    input.location ||
    input.minPriceMinor !== null ||
    input.maxPriceMinor !== null ||
    Object.keys(input.attributes).length
  );
  if (!filtered) return null;
  const category = input.category ? getBrowseCategory(input.category) : null;
  return (
    <section className="buyer-home-context" aria-label={t("filters")}>
      <p>
        <strong>
          {category
            ? t("browsingCategory", { category: category.labels[input.locale] })
            : t("filteredListings")}
        </strong>
      </p>
      <div className="buyer-browse-actions">
        <SourceLink className="pill" href={marketplaceHref("/search", input)}>
          <Icon name="filter" />
          {t("browseAndFilter")}
        </SourceLink>
        <SourceLink
          className="pill"
          preserveDiscoveryContext={false}
          href={discoveryDockDestination("/", discoverySearchParams(input))}
        >
          {t("clear")}
        </SourceLink>
      </div>
    </section>
  );
}
