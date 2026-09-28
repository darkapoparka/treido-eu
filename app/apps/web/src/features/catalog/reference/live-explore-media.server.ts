import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { liveHomeMedia } from "./live-home-media";
import { liveCurationMedia } from "./live-curation-media";
import { liveShelfMedia } from "./live-shelf-media";
import { liveLowerShelfMedia } from "./live-lower-shelf-media";

// Original photograph, not an interface screenshot. Kept private; its credit is
// rendered by the editorial owner. Frozen source hashes remain unchanged.
const photos: Record<
  string,
  {
    file: string;
    sha256: string;
    rect?: readonly [number, number, number, number];
    removeSave?: boolean;
  }
> = {
  "live-explore-cozy-room": {
    file: "ad-room.jpg",
    sha256: "957ef9097bc24078cc0fea1a6effe901f3ca63462acb6fc8b88d7d9bb28c7a2d",
  },
};
photos["live-explore-baby"] = {
  file: "more-grid.png",
  sha256: "11716a61d55388f8bc04b84ac4eed37c187ead3c83d224725bdcdda31a008e6c",
  rect: [72, 654, 256, 256],
};
photos["live-explore-stroller"] = {
  file: "more-grid.png",
  sha256: "11716a61d55388f8bc04b84ac4eed37c187ead3c83d224725bdcdda31a008e6c",
  rect: [348, 654, 256, 256],
};
photos["live-explore-tennis"] = {
  file: "more-grid.png",
  sha256: "11716a61d55388f8bc04b84ac4eed37c187ead3c83d224725bdcdda31a008e6c",
  rect: [676, 654, 256, 256],
};
photos["live-explore-kettlebell"] = {
  file: "more-grid.png",
  sha256: "11716a61d55388f8bc04b84ac4eed37c187ead3c83d224725bdcdda31a008e6c",
  rect: [952, 654, 256, 256],
};
photos["live-explore-cereal"] = {
  file: "more-grid.png",
  sha256: "11716a61d55388f8bc04b84ac4eed37c187ead3c83d224725bdcdda31a008e6c",
  rect: [72, 1074, 256, 256],
};
photos["live-explore-oil"] = {
  file: "more-grid.png",
  sha256: "11716a61d55388f8bc04b84ac4eed37c187ead3c83d224725bdcdda31a008e6c",
  rect: [348, 1074, 256, 256],
};
photos["live-explore-beads"] = {
  file: "more-grid.png",
  sha256: "11716a61d55388f8bc04b84ac4eed37c187ead3c83d224725bdcdda31a008e6c",
  rect: [676, 1074, 256, 256],
};
photos["live-explore-bear"] = {
  file: "more-grid.png",
  sha256: "11716a61d55388f8bc04b84ac4eed37c187ead3c83d224725bdcdda31a008e6c",
  rect: [952, 1074, 256, 256],
};
photos["live-explore-pet-bowl"] = {
  file: "more-grid.png",
  sha256: "11716a61d55388f8bc04b84ac4eed37c187ead3c83d224725bdcdda31a008e6c",
  rect: [72, 1494, 256, 256],
};
photos["live-explore-pet-bed"] = {
  file: "more-grid.png",
  sha256: "11716a61d55388f8bc04b84ac4eed37c187ead3c83d224725bdcdda31a008e6c",
  rect: [348, 1494, 256, 256],
};
photos["live-cozy-wake-light"] = {
  file: "curation-products-2.png",
  sha256: "317153cf1458b083f1c3e7d6a67539de401564e39b9eb07e71913397a7452d67",
  rect: [48, 720, 576, 579],
  removeSave: true,
};
photos["live-cozy-camila-throw"] = {
  file: "curation-products-2.png",
  sha256: "317153cf1458b083f1c3e7d6a67539de401564e39b9eb07e71913397a7452d67",
  rect: [657, 720, 576, 579],
  removeSave: true,
};
photos["live-cozy-olive-mugs"] = {
  file: "curation-products-3.png",
  sha256: "269b26942c0f120f156a6b232c1f37303dd622b804076263186b0023a5b97f6e",
  rect: [48, 561, 576, 576],
  removeSave: true,
};
photos["live-cozy-matisse-throw"] = {
  file: "curation-products-3.png",
  sha256: "269b26942c0f120f156a6b232c1f37303dd622b804076263186b0023a5b97f6e",
  rect: [657, 561, 576, 576],
  removeSave: true,
};
photos["live-cozy-hinoki-candle"] = {
  file: "curation-products-3.png",
  sha256: "269b26942c0f120f156a6b232c1f37303dd622b804076263186b0023a5b97f6e",
  rect: [48, 1404, 576, 579],
  removeSave: true,
};
photos["live-cozy-vera-sconce"] = {
  file: "curation-products-3.png",
  sha256: "269b26942c0f120f156a6b232c1f37303dd622b804076263186b0023a5b97f6e",
  rect: [657, 1404, 576, 579],
  removeSave: true,
};
photos["live-cozy-wavy-lamp"] = {
  file: "curation-products-6.png",
  sha256: "be0974e475a8efc0411fdb706a0463f3c9063a0258a01499e8e5da33b981ea0a",
  rect: [48, 588, 576, 576],
  removeSave: true,
};
photos["live-cozy-nina-rug"] = {
  file: "curation-products-6.png",
  sha256: "be0974e475a8efc0411fdb706a0463f3c9063a0258a01499e8e5da33b981ea0a",
  rect: [657, 588, 576, 576],
  removeSave: true,
};
photos["live-cozy-waffle-pillow"] = {
  file: "curation-products-7.png",
  sha256: "1287a92a07921a6d8b06317b7b7a1df7057acd564451c1f684b72da74d263be2",
  rect: [48, 534, 576, 579],
  removeSave: true,
};
photos["live-cozy-teddy-pillow"] = {
  file: "curation-products-7.png",
  sha256: "1287a92a07921a6d8b06317b7b7a1df7057acd564451c1f684b72da74d263be2",
  rect: [657, 534, 576, 579],
  removeSave: true,
};
photos["live-cozy-fir-candle"] = {
  file: "curation-products-7.png",
  sha256: "1287a92a07921a6d8b06317b7b7a1df7057acd564451c1f684b72da74d263be2",
  rect: [48, 1380, 576, 576],
  removeSave: true,
};
photos["live-cozy-striped-basket"] = {
  file: "curation-products-7.png",
  sha256: "1287a92a07921a6d8b06317b7b7a1df7057acd564451c1f684b72da74d263be2",
  rect: [657, 1380, 576, 576],
  removeSave: true,
};
photos["live-cozy-sateen-sheets"] = {
  file: "curation-products-9.png",
  sha256: "dd1fd2de6acc00840e16ba94be17ae846519e2bbcac3de142e5120a0f4e3a51e",
  rect: [48, 1884, 576, 579],
  removeSave: true,
};
photos["live-cozy-cashmere-throw"] = {
  file: "curation-products-9.png",
  sha256: "dd1fd2de6acc00840e16ba94be17ae846519e2bbcac3de142e5120a0f4e3a51e",
  rect: [657, 1884, 576, 579],
  removeSave: true,
};
photos["live-cozy-honey-tapers"] = {
  file: "curation-products-10.png",
  sha256: "708cf89390c1243df4108d0a09a6b536cf58a53de221e879844bd1ba3403f0f7",
  rect: [48, 1134, 576, 576],
  removeSave: true,
};
photos["live-cozy-amber-glasses"] = {
  file: "curation-products-10.png",
  sha256: "708cf89390c1243df4108d0a09a6b536cf58a53de221e879844bd1ba3403f0f7",
  rect: [657, 1134, 576, 576],
  removeSave: true,
};
photos["live-cozy-match-striker"] = {
  file: "curation-products-11.png",
  sha256: "4e617aa7c79356d5954af43135eab6236860029d3676d6e41258c4c731bc6227",
  rect: [48, 522, 576, 579],
  removeSave: true,
};
photos["live-cozy-pastel-stemware"] = {
  file: "curation-products-11.png",
  sha256: "4e617aa7c79356d5954af43135eab6236860029d3676d6e41258c4c731bc6227",
  rect: [657, 522, 576, 579],
  removeSave: true,
};
photos["live-cozy-film-living-poster"] = {
  file: "film-living-poster.png",
  sha256: "ec29483ad824f9a3a9cf2cb7771e4174223a8857eda2074e8737c4af1b040f18",
};
photos["live-cozy-film-corner-poster"] = {
  file: "film-corner-poster.png",
  sha256: "d81757a2a4361161bbe86b4e9a90ce63452fbe84c8d5520f3ad1d914494bc290",
};
photos["live-cozy-film-bedroom-poster"] = {
  file: "bedroom-settled-review-20260926.png",
  sha256: "b6b1d9c067e76b2bc5a20babeed90aa6dcd32c4af7a8716c912a03b751879516",
  rect: [48, 1446, 1185, 669],
};
photos["live-cozy-match-striker-pdp"] = {
  file: "pdp-match-striker.png",
  sha256: "90fd2a9c73f6e781cb2bbca8be78b332b9d3fd12eda5220734334d5941115317",
  rect: [48, 348, 1184, 1184],
};
photos["live-cozy-hudson-logo"] = {
  file: "pdp-match-striker.png",
  sha256: "90fd2a9c73f6e781cb2bbca8be78b332b9d3fd12eda5220734334d5941115317",
  rect: [60, 192, 96, 96],
};
// Clean native PDP capture on emulator-5560, not the occluded editorial tile.
photos["live-cozy-wake-light-pdp"] = {
  file: "pdp-wake-light-final-20260926.png",
  sha256: "1f0d8108480efb99b41edb284a99db95e11ba3cea02f7fab3d7a7252d77a625d",
  rect: [48, 348, 1184, 1184],
};
photos["live-cozy-tala-logo"] = {
  file: "pdp-wake-light-final-20260926.png",
  sha256: "1f0d8108480efb99b41edb284a99db95e11ba3cea02f7fab3d7a7252d77a625d",
  rect: [60, 192, 96, 96],
};
photos["live-cozy-wake-light-photo-2"] = {
  file: "pdp-wake-light-photo-2-final.png",
  sha256: "d04b229a1c68ca3b382de51275c92fe67507a2f9d0541917225970380b40ebf4",
  rect: [0, 788, 1280, 1280],
};
photos["live-cozy-wake-light-photo-3"] = {
  file: "pdp-wake-light-photo-3-final.png",
  sha256: "cab98224f12fd2e28f2d7fdc4b45782c6b763b2a9831fbe66db50bb6a0ca4b70",
  rect: [0, 788, 1280, 1280],
};
photos["live-cozy-wake-light-photo-4"] = {
  file: "pdp-wake-light-photo-4-final.png",
  sha256: "752b078447f3491401b17cd42ef25a030e2ced79834a553b9db15ec995b43011",
  rect: [0, 788, 1280, 1280],
};
photos["live-cozy-wake-light-photo-5"] = {
  file: "pdp-wake-light-photo-5-final.png",
  sha256: "4cc56cc1ed7d8db6692534e760b52732297a3267891810b461de67170b3ae507",
  rect: [0, 788, 1280, 1280],
};
photos["live-cozy-wake-light-photo-6"] = {
  file: "pdp-wake-light-photo-6-final.png",
  sha256: "e9fd2aa21b9fe6ade115b8c75ede885fc59d22e024a8d96f5edce57c7e8fe22f",
  rect: [0, 788, 1280, 1280],
};
photos["live-cozy-wake-light-photo-7"] = {
  file: "pdp-wake-light-photo-7-final.png",
  sha256: "feac603bcc32b956f99914c5a3f4692ae678e249eae4be8c8f15b7687dca3b4a",
  rect: [0, 788, 1280, 1280],
};
photos["live-cozy-wake-light-photo-8"] = {
  file: "pdp-wake-light-photo-8-final.png",
  sha256: "17ed10466ea47b2949e703604c8376a29b776b48de431b6b0f145b8a9e6356db",
  rect: [0, 788, 1280, 1280],
};
photos["live-cozy-wake-light-photo-9"] = {
  file: "pdp-wake-light-photo-9-final.png",
  sha256: "2209709c1b3266064c02e11a8d60ac4223e77bbf62e02a392c22848368cc7b82",
  rect: [0, 788, 1280, 1280],
};
photos["live-cozy-wake-light-photo-10"] = {
  file: "pdp-wake-light-photo-10-final.png",
  sha256: "42246baadcce9b2060fa757826a6911a400bc4756f3055c7e69d9e322691721f",
  rect: [0, 788, 1280, 1280],
};
photos["live-cozy-wake-light-swatch"] = {
  file: "pdp-wake-light-final-20260926.png",
  sha256: "1f0d8108480efb99b41edb284a99db95e11ba3cea02f7fab3d7a7252d77a625d",
  rect: [72, 1995, 96, 96],
};
photos["live-mini-makeup-icon"] = {
  file: "resumed-explore-lower.png",
  sha256: "c26d00f21d9477f229665e4a6d13478e0f561e7e931182637589fb5ee1a35044",
  rect: [48, 1446, 132, 132],
};
photos["live-mini-picnic-icon"] = {
  file: "resumed-explore-lower.png",
  sha256: "c26d00f21d9477f229665e4a6d13478e0f561e7e931182637589fb5ee1a35044",
  rect: [48, 1857, 132, 132],
};
photos["live-mini-signin"] = {
  file: "resumed-picnic-entry.png",
  sha256: "b1f2acb74395bfaa3d28a9a7edcc81ba247e89cc0154c403c1e45fb98205eb3e",
  rect: [472, 1158, 336, 336],
};
photos["live-mini-makeup-hero"] = {
  file: "resumed-minis-catalog.png",
  sha256: "39c344394c1dda28d40639b0c6f5dcf0c90ee98813506a1360314b437caddd0c",
  rect: [72, 420, 1112, 600],
};
photos["live-mini-room-icon"] = {
  file: "resumed-minis-catalog.png",
  sha256: "39c344394c1dda28d40639b0c6f5dcf0c90ee98813506a1360314b437caddd0c",
  rect: [48, 1449, 132, 132],
};
photos["live-mini-color-icon"] = {
  file: "resumed-minis-catalog.png",
  sha256: "39c344394c1dda28d40639b0c6f5dcf0c90ee98813506a1360314b437caddd0c",
  rect: [48, 1617, 132, 132],
};
photos["live-mini-pair-icon"] = {
  file: "resumed-minis-catalog.png",
  sha256: "39c344394c1dda28d40639b0c6f5dcf0c90ee98813506a1360314b437caddd0c",
  rect: [48, 1785, 132, 132],
};
photos["live-mini-homescape-icon"] = {
  file: "resumed-minis-catalog.png",
  sha256: "39c344394c1dda28d40639b0c6f5dcf0c90ee98813506a1360314b437caddd0c",
  rect: [48, 2135, 132, 132],
};
photos["live-mini-rumi-icon"] = {
  file: "resumed-minis-catalog.png",
  sha256: "39c344394c1dda28d40639b0c6f5dcf0c90ee98813506a1360314b437caddd0c",
  rect: [48, 2303, 132, 132],
};
photos["live-mini-space-icon"] = {
  file: "resumed-minis-catalog.png",
  sha256: "39c344394c1dda28d40639b0c6f5dcf0c90ee98813506a1360314b437caddd0c",
  rect: [48, 2471, 132, 132],
};
photos["live-makeup-welcome-art"] = {
  file: "resumed-makeup-welcome.png",
  sha256: "e98af5bf1894ea5f81773e8f9a5bdb741050d7c98c00c3046fa578aa77662bcd",
  rect: [0, 288, 1280, 2256],
};
photos["live-makeup-selfie"] = {
  file: "resumed-makeup-upload.png",
  sha256: "4c54819d7ee048ec909b31d91dd7e6972dca0e8eb944e357372d3bc48de72e09",
  rect: [141, 942, 999, 1437],
};
photos["live-makeup-upload-wordmark"] = {
  file: "resumed-makeup-upload.png",
  sha256: "4c54819d7ee048ec909b31d91dd7e6972dca0e8eb944e357372d3bc48de72e09",
  rect: [186, 600, 909, 102],
};
photos["live-makeup-pink-texture"] = {
  file: "resumed-makeup-upload.png",
  sha256: "4c54819d7ee048ec909b31d91dd7e6972dca0e8eb944e357372d3bc48de72e09",
  rect: [160, 318, 1020, 225],
};
photos["live-makeup-lipstick"] = {
  file: "resumed-makeup-upload.png",
  sha256: "4c54819d7ee048ec909b31d91dd7e6972dca0e8eb944e357372d3bc48de72e09",
  rect: [48, 2658, 84, 87],
};
photos["live-makeup-history-wordmark"] = {
  file: "resumed-makeup-history.png",
  sha256: "d5281c3c6a9e6e446cc0005b14e2eb7a38ba7c668776729db8feef3018d74938",
  rect: [369, 420, 543, 75],
};
photos["live-makeup-pale-texture"] = {
  file: "resumed-makeup-history.png",
  sha256: "d5281c3c6a9e6e446cc0005b14e2eb7a38ba7c668776729db8feef3018d74938",
  rect: [0, 540, 1280, 2256],
};
photos["live-mini-look-hero"] = {
  file: "resumed-mini-feature-look.png",
  sha256: "9b283e5d02c728c821af7e7cefde5276fe22d827d0453b85c6a20da2e14aaf9a",
  rect: [72, 420, 1112, 600],
};
photos["live-mini-picnic-hero"] = {
  file: "resumed-mini-feature-picnic.png",
  sha256: "d347a6acd4da81ce446633b1b4e02de5e8a656aa26ed077037e3158eafad4e96",
  rect: [72, 420, 1112, 600],
};
photos["live-mini-gift-hero"] = {
  file: "resumed-mini-feature-gift.png",
  sha256: "95168469dcac3142d9637acb53964ebcd38cba47bc209a30387387e77e1201b8",
  rect: [72, 420, 1112, 600],
};
photos["live-mini-recipe-icon"] = {
  file: "resumed-mini-snap-second.png",
  sha256: "ee9a050e2e029096f5e9101540fdb975c0fb496d13c325dc58dee971ca69400f",
  rect: [230, 1871, 132, 132],
};
photos["live-mini-steal-icon"] = {
  file: "resumed-mini-snap-second.png",
  sha256: "ee9a050e2e029096f5e9101540fdb975c0fb496d13c325dc58dee971ca69400f",
  rect: [230, 2207, 132, 132],
};
photos["live-mini-nest-icon"] = {
  file: "resumed-mini-design-second.png",
  sha256: "9d2f3cb65bdfdbb2935c5cf8aae8f3f0967e1a458e26992c92226227c3ca02d9",
  rect: [208, 1249, 132, 132],
};
photos["live-mini-glow-icon"] = {
  file: "resumed-mini-lower.png",
  sha256: "cf282a02b506ecc405fff1afca9535751ecfcfee81e938def81973c24a0706d5",
  rect: [48, 1935, 132, 132],
};
photos["live-mini-makeupify-icon"] = {
  file: "resumed-mini-lower.png",
  sha256: "cf282a02b506ecc405fff1afca9535751ecfcfee81e938def81973c24a0706d5",
  rect: [48, 2103, 132, 132],
};
photos["live-mini-selfe-icon"] = {
  file: "resumed-mini-beauty-second.png",
  sha256: "36773a36598d2e5045010fbc3e67919c77bd89580be2ea01e8e41ce12a061a3b",
  rect: [225, 1935, 132, 132],
};
photos["live-mini-skin-icon"] = {
  file: "resumed-mini-beauty-second.png",
  sha256: "36773a36598d2e5045010fbc3e67919c77bd89580be2ea01e8e41ce12a061a3b",
  rect: [225, 2103, 132, 132],
};
photos["live-mini-fridays-icon"] = {
  file: "resumed-mini-beauty-second.png",
  sha256: "36773a36598d2e5045010fbc3e67919c77bd89580be2ea01e8e41ce12a061a3b",
  rect: [225, 2271, 132, 132],
};
photos["live-cozy-match-striker-photo-2"] = {
  file: "resumed-match-gallery-2.png",
  sha256: "fa03b12431deaec2bdf855f9fcc67eeb108e17d2c0bcff1b253731ab0baeb3d7",
  rect: [0, 788, 1280, 1280],
};
photos["live-look-wordmark"] = {
  file: "resumed-look-welcome.png",
  sha256: "47aaeaa8913254c66dde7c4d5c51b849bdfbaa9bb2ce6d397cf8238168e03bbe",
  rect: [150, 549, 981, 822],
};
Object.assign(
  photos,
  liveCurationMedia,
  liveShelfMedia,
  liveLowerShelfMedia,
  liveHomeMedia,
);
const pending = new Map<string, Promise<Buffer>>();
export function readLiveExploreMedia(key: string): Promise<Buffer> | undefined {
  // Android product galleries request a 3x srcset candidate. These crops
  // already retain their source resolution; share the verified bytes rather
  // than inventing an upscale or letting high-density screens select a 404.
  const sourceKey = key.endsWith("-3x") ? key.slice(0, -3) : key;
  if (!Object.hasOwn(photos, sourceKey)) return undefined;
  const existing = pending.get(sourceKey);
  if (existing) return existing;
  const photo = photos[sourceKey];
  const job = (async () => {
    const bytes = await readFile(
      resolve(
        process.cwd(),
        "../../.local/shop-reference/live/android-explore-20260926",
        photo.file,
      ),
    );
    if (createHash("sha256").update(bytes).digest("hex") !== photo.sha256)
      throw new Error("Live Explore photograph source has changed");
    const image = sharp(bytes);
    // New full-resolution merchant originals are retained privately. Serve a
    // native-width derivative instead of decoding dozens of 3000px images.
    // This never upscales or changes the frozen source readers.
    if (
      (Object.hasOwn(liveShelfMedia, sourceKey) ||
        Object.hasOwn(liveLowerShelfMedia, sourceKey) ||
        Object.hasOwn(liveHomeMedia, sourceKey)) &&
      !photo.rect
    )
      image.resize({ width: 1280, withoutEnlargement: true });
    if (photo.rect) {
      const [left, top, width, height] = photo.rect;
      image.extract({ left, top, width, height });
    }
    if (photo.removeSave && photo.rect) {
      const [, , width, height] = photo.rect;
      const input = await image.png().toBuffer();
      const scale = width / 192;
      // Remove the captured Save control. Only a local photograph-color sample
      // fills its occlusion; the actual interactive button is rendered by React.
      // The hidden photographic detail remains an explicit reference limitation.
      const stats = await sharp(input)
        .extract({
          left: width - Math.round(62 * scale),
          top: height - Math.round(36 * scale),
          width: Math.round(10 * scale),
          height: Math.round(22 * scale),
        })
        .stats();
      const fill =
        "rgb(" +
        stats.channels
          .slice(0, 3)
          .map((channel) => Math.round(channel.mean))
          .join(",") +
        ")";
      const circle =
        '<svg xmlns="http://www.w3.org/2000/svg" width="' +
        width +
        '" height="' +
        height +
        '"><circle cx="' +
        (width - 28 * scale) +
        '" cy="' +
        (height - 28 * scale) +
        '" r="' +
        17 * scale +
        '" fill="' +
        fill +
        '"/></svg>';
      return sharp(input)
        .composite([{ input: Buffer.from(circle) }])
        .webp({ lossless: true })
        .toBuffer();
    }
    return image.webp({ lossless: true }).toBuffer();
  })();
  pending.set(sourceKey, job);
  void job.catch(() => pending.delete(sourceKey));
  return job;
}
