"use client";
/* eslint-disable @next/next/no-img-element -- Verified private native photographs. */
import { useCaption } from "../locale/use-caption";
import { useTranslations } from "next-intl";
import { Icon } from "./icons";
import { SourceLink } from "./return-navigation";
import "./home-category.css";

const categories = [
  ["Kitchen & dining", "kitchen"],
  ["Decor", "decor"],
  ["Bedding", "bedding"],
  ["Plants", "plants"],
  ["Towels", "towels"],
  ["Household appliances", "appliances"],
  ["Lighting", "lighting"],
  ["Furniture", "furniture"],
] as const;
export function HomeCategoryIntro() {
  const caption = useCaption();
  const ui = useTranslations("discoveryUI");
  return (
    <>
      <nav
        className="native-home-categories"
        aria-label={ui("homeCategories")}
        data-ui-label="homeCategories"
      >
        {categories.map(([name, image]) => (
          <SourceLink
            key={name}
            href={`/search?category=Home&q=${encodeURIComponent(name)}`}
            startAtTop
          >
            <img src={`/api/reference-media/live-home-${image}-icon`} alt="" />
            <span>{caption(name)}</span>
          </SourceLink>
        ))}
      </nav>
      <SourceLink
        className="native-home-hero"
        href="/explore/curations/living-room"
        startAtTop
      >
        <img
          src="/api/reference-media/live-home-living-room"
          alt={ui("paperLanternBesideAVaseOfBranches")}
        />
        <div>
          <strong>{ui("livingRoomGlowUp")}</strong>
          <p>{ui("chicLightingSideTablesAndLinenLayers")}</p>
        </div>
        <Icon name="arrow" />
      </SourceLink>
    </>
  );
}

export function HomeCategoryEditorial() {
  const ui = useTranslations("discoveryUI");
  return (
    <SourceLink
      className="native-home-editorial"
      href="/explore/curations/cozy-edit"
      startAtTop
    >
      <img
        src="/api/reference-media/live-explore-cozy-room"
        alt={ui("architecturalDigestSCozyLivingRoom")}
      />
      <div>
        <strong>{ui("architecturalDigestSCozyEdit")}</strong>
        <p>{ui("makeYourHomeFeelLikeASanctuaryThisFall")}</p>
      </div>
    </SourceLink>
  );
}
