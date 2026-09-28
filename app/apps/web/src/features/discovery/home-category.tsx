"use client";
/* eslint-disable @next/next/no-img-element -- Verified private native photographs. */
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
  return (
    <>
      <nav className="native-home-categories" aria-label="Home categories">
        {categories.map(([name, image]) => (
          <SourceLink
            key={name}
            href={`/search?category=Home&q=${encodeURIComponent(name)}`}
            startAtTop
          >
            <img src={`/api/reference-media/live-home-${image}-icon`} alt="" />
            <span>{name}</span>
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
          alt="Paper lantern beside a vase of branches"
        />
        <div>
          <strong>Living room glow up</strong>
          <p>Chic lighting, side tables, and linen layers.</p>
        </div>
        <Icon name="arrow" />
      </SourceLink>
    </>
  );
}

export function HomeCategoryEditorial() {
  return (
    <SourceLink
      className="native-home-editorial"
      href="/explore/curations/cozy-edit"
      startAtTop
    >
      <img
        src="/api/reference-media/live-explore-cozy-room"
        alt="Architectural Digest's cozy living room"
      />
      <div>
        <strong>Architectural Digest&apos;s cozy edit</strong>
        <p>Make your home feel like a sanctuary this fall.</p>
      </div>
    </SourceLink>
  );
}
