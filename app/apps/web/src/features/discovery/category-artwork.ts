import type { CSSProperties } from "react";

/** Visible alpha bounds (>=20/255), calibrated against the original artwork.
 * Align the objects themselves, including their contact shadows, rather than
 * relying on equal transparent canvas dimensions. */
const bounds: Readonly<
  Record<string, readonly [number, number, number, number]>
> = {
  electronics: [17, 77, 319, 290],
  fashion: [0, 44, 319, 306],
  home: [0, 43, 295, 308],
  appliances: [39, 66, 315, 253],
  garden: [7, 10, 313, 273],
  "garden-diy": [34, 31, 301, 280],
  "sports-outdoors": [21, 24, 313, 303],
  "baby-kids": [18, 43, 302, 299],
  "beauty-care": [9, 59, 297, 293],
  "books-media": [29, 23, 315, 269],
  "hobbies-collectibles": [25, 33, 306, 276],
  music: [7, 0, 294, 275],
  gaming: [24, 53, 304, 294],
  "motors-parts": [2, 45, 306, 296],
  "pet-supplies": [10, 87, 303, 298],
  "business-equipment": [26, 63, 305, 280],
  "art-handmade": [9, 7, 286, 284],
};

/** Original generated department illustrations, never public listing photos. */
export function categoryArtwork(id: string): string | undefined {
  const slug = id.startsWith("cat:") ? id.slice(4) : "";
  return Object.hasOwn(bounds, slug)
    ? `/artwork/categories/${slug}.webp`
    : undefined;
}

export function categoryArtworkStyle(
  source: string,
): CSSProperties | undefined {
  const slug = source.replace("/artwork/categories/", "").replace(".webp", "");
  if (source !== categoryArtwork(`cat:${slug}`)) return undefined;
  const [left, top, right, bottom] = bounds[slug];
  const visibleHeight = bottom - top + 1;
  // A shared 72% visual height and 90% baseline fit the existing 86px frame.
  return {
    "--department-art-height": `${(320 * 72) / visibleHeight}%`,
    "--department-art-top": `${90 - ((bottom + 1) * 72) / visibleHeight}%`,
    "--department-art-x": `${-((left + right + 1) * 50) / 320}%`,
  } as CSSProperties;
}
