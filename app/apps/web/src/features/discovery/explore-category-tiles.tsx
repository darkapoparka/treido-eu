/* eslint-disable @next/next/no-img-element -- Guarded reference or eligible public listing media. */
import type { Ref } from "react";
import { SourceLink } from "./return-navigation";
import { Icon } from "./icons";
import { categoryArtworkStyle } from "./category-artwork";
export type ExploreCategoryTile = {
  id: string;
  title: string;
  href: string;
  color: string;
  photos: readonly string[];
  artwork?: string;
};

/** Original Explore tile DOM, shared by replay departments and real taxonomy. */
export function ExploreCategoryTiles({
  tiles,
  gridRef,
}: {
  tiles: readonly ExploreCategoryTile[];
  gridRef?: Ref<HTMLDivElement>;
}) {
  return (
    <div className="explore-categories" id="explore-categories" ref={gridRef}>
      {tiles.map((tile) => (
        <SourceLink
          key={tile.id}
          style={{ background: tile.color }}
          href={tile.href}
        >
          <h3 title={tile.title}>{tile.title}</h3>
          <div
            className={tile.artwork ? "buyer-department-art-frame" : undefined}
          >
            {tile.artwork ? (
              <img
                className="buyer-department-art"
                style={categoryArtworkStyle(tile.artwork)}
                src={tile.artwork}
                alt=""
                width={320}
                height={320}
                loading="lazy"
              />
            ) : tile.photos.length ? (
              tile.photos.map((src) => <img key={src} src={src} alt="" />)
            ) : (
              <span className="buyer-category-placeholder">
                <Icon name="explore" />
              </span>
            )}
          </div>
        </SourceLink>
      ))}
    </div>
  );
}
