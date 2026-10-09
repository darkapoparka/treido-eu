"use client";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { getBrowseCategory } from "@treido/contracts/categories";
import type { DiscoveryInput } from "../catalog/discovery-input";
import {
  marketplaceHref,
  marketplaceResultsHref,
} from "./marketplace-navigation";
import { SourceLink } from "./return-navigation";
export function BuyerAvailability({
  unavailable,
  home = false,
  categoryLabel,
  input,
}: {
  unavailable?: boolean;
  home?: boolean;
  categoryLabel?: string;
  input?: DiscoveryInput;
}) {
  const t = useTranslations("marketplace"),
    router = useRouter();
  const scope = useTranslations("scope");
  const category = input?.category ? getBrowseCategory(input.category) : null;
  const label = categoryLabel ?? (input && category?.labels[input.locale]);
  const allSellers =
    !unavailable && input && input.seller !== "all"
      ? home
        ? marketplaceHref("/", { ...input, seller: "all" })
        : marketplaceResultsHref({ ...input, seller: "all" })
      : null;
  return (
    <section className="empty-state" role="status">
      <h2>{t(unavailable ? "unavailableTitle" : "emptyTitle")}</h2>
      <p>
        {!unavailable && label
          ? t("emptyCategory", { category: label })
          : t(unavailable ? "unavailable" : home ? "emptyHome" : "emptySearch")}
      </p>
      {allSellers && (
        <SourceLink
          className="pill"
          href={allSellers}
          preserveDiscoveryContext={false}
          startAtTop
        >
          {scope("reset")}
        </SourceLink>
      )}
      {unavailable && (
        <button type="button" className="pill" onClick={() => router.refresh()}>
          {t("retry")}
        </button>
      )}
    </section>
  );
}
