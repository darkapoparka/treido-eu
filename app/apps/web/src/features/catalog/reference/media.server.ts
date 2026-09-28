import "server-only";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp, { type OverlayOptions } from "sharp";
// Rectangles are measured on a 393px-wide reference, including its system chrome.
// Only product photography, brand marks and decorative imagery are extracted.
// Interface text, cards, navigation and controls are rendered by React, never screenshots.
type RoundedOcclusion = readonly [
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
];
const media: Record<
  string,
  {
    file: string;
    rect: readonly [number, number, number, number];
    // Remove captured interface occlusions from tightly cropped product photography.
    // The image never supplies price labels, save controls, card edges or navigation.
    occlusions?: readonly (readonly [number, number, number, number])[];
    // Remove light caption ink within these bounds, preserving the surrounding
    // photo instead of clearing a rectangular block behind the DOM caption.
    lightTextOcclusions?: readonly (readonly [
      number,
      number,
      number,
      number,
    ])[];
    // Remove dark interface ink without clearing the photograph behind it.
    darkTextOcclusions?: readonly (readonly [number, number, number, number])[];
    darkTextThreshold?: number;
    textOcclusionDilation?: number;
    textOcclusionMode?: "transparent" | "inpaint";
    // Remove the captured Mini background while retaining its live page gradient.
    pinkChromaKey?: boolean;
    // Deskew a captured photograph, then retain a measured inner source region.
    rotateDegrees?: number;
    postRotateRect?: readonly [number, number, number, number];
    // Fill removed native annotations with a clean capture of the same photo.
    // Only one underlay level is allowed; interface pixels are never retained.
    underlayKey?: string;
    // Exclude the recorded card edge while retaining only its product photograph.
    photoRadius?: number;
    // A partial photograph ends at the capture edge, not at a card corner.
    photoTopCornersOnly?: boolean;
    // Circular native controls are removed without erasing extra photo corners.
    circularOcclusions?: readonly (readonly [number, number, number])[];
    // Pill controls preserve surrounding photography with their measured radius.
    roundedOcclusions?: readonly RoundedOcclusion[];
    // Native overlays with no clean photo beneath must remain transparent,
    // including when separate price exclusions use edge-color filling.
    transparentRoundedOcclusions?: readonly RoundedOcclusion[];
    // Smooth colors beneath removed native UI, sampled from the two exposed
    // edges on the selected axis. This does not reconstruct hidden detail.
    roundedOcclusionFill?: "horizontal-gradient" | "vertical-gradient";
    // Retain a white brand mark without the photograph behind its source crop.
    lightWordmark?: boolean;
  }
> = {
  "beauty-curls-photo": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/002.webp",
    rect: [16, 196, 361, 203],
    photoRadius: 28,
    lightTextOcclusions: [
      [19, 140, 176, 23],
      [19, 164, 187, 19],
    ],
    circularOcclusions: [[325, 166, 17]],
    textOcclusionMode: "inpaint",
    textOcclusionDilation: 0.75,
  },
  "beauty-starter-photo": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/003.webp",
    rect: [16, 393, 361, 203],
    photoRadius: 28,
    lightTextOcclusions: [
      [19, 142, 177, 23],
      [19, 166, 254, 19],
    ],
    circularOcclusions: [[325, 167, 17]],
    textOcclusionMode: "inpaint",
    textOcclusionDilation: 0.75,
  },
  "beauty-perfume-photo": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/004.webp",
    rect: [16, 116, 176, 83],
    photoRadius: 14,
    lightTextOcclusions: [[25, 31, 126, 22]],
  },
  "beauty-bath-photo": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/004.webp",
    rect: [201, 116, 176, 83],
    photoRadius: 14,
    lightTextOcclusions: [[46, 31, 85, 22]],
  },
  "beauty-hair-photo": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/004.webp",
    rect: [16, 208, 176, 83],
    photoRadius: 14,
    lightTextOcclusions: [[49, 23, 84, 39]],
  },
  "beauty-nail-photo": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/004.webp",
    rect: [201, 208, 176, 83],
    photoRadius: 14,
    lightTextOcclusions: [[57, 31, 63, 22]],
  },
  "chemical-video-photo": {
    file: "flows/154e77d4-6ee5-4215-9dd4-2688a0035e16/002.webp",
    rect: [0, 59, 393, 793],
    occlusions: [
      [67, 617, 103, 17],
      [68, 637, 37, 15],
      [64, 672, 295, 17],
      [64, 690, 41, 14],
      [16, 667, 40, 41],
      [27, 729, 17, 20],
      [59, 737, 311, 4],
    ],
    circularOcclusions: [
      [37, 20, 23],
      [355, 20, 23],
      [355, 78, 23],
      [38, 634, 27],
    ],
  },
  "chemical-video-logo": {
    file: "flows/154e77d4-6ee5-4215-9dd4-2688a0035e16/002.webp",
    rect: [20, 675, 38, 38],
    photoRadius: 19,
  },
  "chemical-video-item-photo": {
    file: "flows/154e77d4-6ee5-4215-9dd4-2688a0035e16/002.webp",
    rect: [27, 734, 15, 29],
  },
  "chemical-store-header-photo": {
    file: "flows/154e77d4-6ee5-4215-9dd4-2688a0035e16/001.webp",
    rect: [1, 68, 391, 144],
    roundedOcclusions: [
      [14, 83, 111, 42, 21],
      [127, 83, 84, 42, 21],
      [213, 83, 110, 42, 21],
      [325, 83, 67, 42, 21],
    ],
    circularOcclusions: [
      [37, 37, 23],
      [85, 37, 23],
    ],
    photoRadius: 35,
  },
  "chemical-store-trim-photo": {
    file: "flows/154e77d4-6ee5-4215-9dd4-2688a0035e16/001.webp",
    rect: [33, 267, 133, 133],
    occlusions: [[10, 10, 51, 19]],
    circularOcclusions: [[106, 106, 17]],
    photoRadius: 19,
  },
  "chemical-store-protect-photo": {
    file: "flows/154e77d4-6ee5-4215-9dd4-2688a0035e16/001.webp",
    rect: [176, 267, 133, 133],
    occlusions: [[10, 10, 44, 19]],
    circularOcclusions: [[106, 106, 17]],
    photoRadius: 19,
  },
  "chemical-store-deep-partial": {
    file: "flows/154e77d4-6ee5-4215-9dd4-2688a0035e16/001.webp",
    rect: [319, 267, 57, 133],
    occlusions: [[10, 10, 47, 19]],
  },
  "chemical-store-clip-one": {
    file: "flows/154e77d4-6ee5-4215-9dd4-2688a0035e16/001.webp",
    rect: [17, 477, 108, 158],
    lightTextOcclusions: [[9, 130, 48, 20]],
    textOcclusionMode: "inpaint",
    photoRadius: 19,
  },
  "chemical-store-clip-two": {
    file: "flows/154e77d4-6ee5-4215-9dd4-2688a0035e16/001.webp",
    rect: [134, 477, 108, 158],
    lightTextOcclusions: [[9, 130, 48, 20]],
    textOcclusionMode: "inpaint",
    photoRadius: 19,
  },
  "chemical-store-clip-three": {
    file: "flows/154e77d4-6ee5-4215-9dd4-2688a0035e16/001.webp",
    rect: [251, 477, 108, 158],
    lightTextOcclusions: [[9, 130, 48, 20]],
    textOcclusionMode: "inpaint",
    photoRadius: 19,
  },
  "chemical-store-clip-four-partial": {
    file: "flows/154e77d4-6ee5-4215-9dd4-2688a0035e16/001.webp",
    rect: [368, 477, 25, 158],
    lightTextOcclusions: [[0, 130, 25, 20]],
    textOcclusionMode: "inpaint",
  },
  "chemical-featured-one-partial": {
    file: "flows/154e77d4-6ee5-4215-9dd4-2688a0035e16/001.webp",
    rect: [35, 710, 129, 52],
    photoRadius: 18,
  },
  "chemical-featured-two-partial": {
    file: "flows/154e77d4-6ee5-4215-9dd4-2688a0035e16/001.webp",
    rect: [178, 710, 129, 52],
    photoRadius: 18,
  },
  "chemical-featured-three-partial": {
    file: "flows/154e77d4-6ee5-4215-9dd4-2688a0035e16/001.webp",
    // The rightmost photo lies beyond the recorded dock. Keep the other two
    // crops bounded above it; only this visible photograph continues to y852.
    rect: [321, 710, 55, 142],
    occlusions: [
      [0, 0, 17, 9],
      [0, 9, 5, 8],
    ],
  },
  "chemical-category-shop": {
    file: "flows/154e77d4-6ee5-4215-9dd4-2688a0035e16/001.webp",
    rect: [20, 156, 30, 30],
    photoRadius: 15,
  },
  "chemical-category-kits": {
    file: "flows/154e77d4-6ee5-4215-9dd4-2688a0035e16/001.webp",
    rect: [134, 156, 30, 30],
    photoRadius: 15,
  },
  "chemical-category-exterior": {
    file: "flows/154e77d4-6ee5-4215-9dd4-2688a0035e16/001.webp",
    rect: [219, 156, 30, 30],
    photoRadius: 15,
  },
  "chemical-category-interior": {
    file: "flows/154e77d4-6ee5-4215-9dd4-2688a0035e16/001.webp",
    rect: [333, 156, 30, 30],
    photoRadius: 15,
  },
  "beauty-whip-card-photo": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/002.webp",
    rect: [17, 471, 170, 170],
    photoRadius: 21,
    occlusions: [[10, 10, 58, 19]],
    roundedOcclusions: [[126, 126, 34, 34, 17]],
    roundedOcclusionFill: "vertical-gradient",
  },
  "beauty-hanacure-card-photo": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/002.webp",
    rect: [198, 471, 170, 170],
    photoRadius: 21,
    occlusions: [[10, 10, 76, 19]],
    roundedOcclusions: [[126, 126, 34, 34, 17]],
    roundedOcclusionFill: "vertical-gradient",
  },
  "beauty-bubble-card-photo": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/003.webp",
    rect: [17, 111, 170, 170],
    photoRadius: 21,
    roundedOcclusions: [[126, 126, 34, 34, 17]],
    roundedOcclusionFill: "vertical-gradient",
  },
  "beauty-bare-card-photo": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/003.webp",
    rect: [198, 111, 170, 170],
    photoRadius: 21,
    occlusions: [[10, 10, 58, 19]],
    roundedOcclusions: [[126, 126, 34, 34, 17]],
    roundedOcclusionFill: "vertical-gradient",
  },
  "beauty-athena-header": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/005.webp",
    rect: [17, 125, 175, 118],
    lightTextOcclusions: [[30, 73, 118, 42]],
    textOcclusionMode: "inpaint",
  },
  "beauty-crown-header": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/005.webp",
    rect: [202, 125, 174, 118],
    lightTextOcclusions: [[30, 73, 118, 42]],
    textOcclusionMode: "inpaint",
  },
  "beauty-starface-header": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/005.webp",
    rect: [17, 422, 175, 118],
    lightTextOcclusions: [[24, 67, 130, 43]],
    textOcclusionMode: "inpaint",
  },
  "beauty-necessaire-header": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/005.webp",
    rect: [202, 422, 174, 118],
    darkTextOcclusions: [[24, 67, 126, 43]],
    textOcclusionMode: "inpaint",
  },
  "beauty-athena-card-photo": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/005.webp",
    rect: [25, 245, 158, 158],
    photoRadius: 21,
    occlusions: [[10, 10, 51, 19]],
  },
  "beauty-crown-card-photo": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/005.webp",
    rect: [210, 245, 158, 158],
    photoRadius: 21,
  },
  "beauty-starface-card-photo": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/005.webp",
    rect: [25, 542, 158, 158],
    photoRadius: 21,
  },
  "beauty-necessaire-card-photo": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/005.webp",
    rect: [210, 542, 158, 158],
    photoRadius: 21,
    occlusions: [[10, 10, 59, 19]],
  },
  "confirmation-black-conditioner-photo": {
    file: "flows/c61e4d3b-629f-48b5-a322-5472f46e9b1b/001.webp",
    rect: [17, 550, 171, 171],
    photoRadius: 19,
    circularOcclusions: [[144, 144, 16]],
  },
  "receipt-shampoo-bag-photo": {
    file: "flows/c61e4d3b-629f-48b5-a322-5472f46e9b1b/002.webp",
    rect: [16, 181, 56, 57],
    photoRadius: 8,
  },
  "confirmation-chocolate-body-photo": {
    file: "flows/c61e4d3b-629f-48b5-a322-5472f46e9b1b/001.webp",
    rect: [198, 550, 171, 171],
    photoRadius: 19,
    circularOcclusions: [[143, 144, 16]],
  },
  "pdp-bag-black-conditioner-bag-recommendation": {
    file: "flows/a99e7161-595d-466c-b0b1-bc1183f1d4d7/009.webp",
    rect: [17, 585, 171, 171],
    photoRadius: 20,
    circularOcclusions: [[143, 143, 16]],
  },
  "pdp-bag-chocolate-body-bag-recommendation": {
    file: "flows/a99e7161-595d-466c-b0b1-bc1183f1d4d7/009.webp",
    rect: [205, 585, 171, 171],
    photoRadius: 20,
    circularOcclusions: [[144, 143, 16]],
  },
  "assistant-dad-comparison-photo": {
    file: "flows/d6910bbb-655d-44ad-842e-11da062a1e66/007.webp",
    rect: [24, 303, 166, 166],
    photoRadius: 24,
    circularOcclusions: [[137, 137, 16]],
  },
  "assistant-armor-comparison-photo": {
    file: "flows/d6910bbb-655d-44ad-842e-11da062a1e66/007.webp",
    rect: [24, 501, 166, 166],
    photoRadius: 24,
    circularOcclusions: [
      [137, 138, 16],
      [51, 152, 3],
      [59, 152, 3],
      [67, 152, 3],
      [75, 152, 3],
      [83, 152, 3],
      [91, 152, 3],
      [99, 152, 3],
      [107, 152, 3],
      [115, 152, 3],
    ],
  },
  // Only the exposed continuation photograph is known; the comparison
  // card does not establish this cropped recommendation's product identity.
  "assistant-structured-first-fragment": {
    file: "flows/d6910bbb-655d-44ad-842e-11da062a1e66/005.webp",
    rect: [17, 766, 150, 86],
    photoRadius: 20,
    photoTopCornersOnly: true,
    roundedOcclusions: [[-5, -6, 305, 56, 28]],
  },
  "assistant-structured-second-fragment": {
    file: "flows/d6910bbb-655d-44ad-842e-11da062a1e66/005.webp",
    rect: [177, 766, 150, 86],
    photoRadius: 20,
    photoTopCornersOnly: true,
    roundedOcclusions: [[-165, -6, 305, 56, 28]],
    circularOcclusions: [[176, 22, 29]],
  },
  "assistant-structured-third-fragment": {
    file: "flows/d6910bbb-655d-44ad-842e-11da062a1e66/005.webp",
    rect: [337, 766, 55, 86],
    circularOcclusions: [[16, 22, 29]],
  },
  "assistant-armor-logo": {
    file: "flows/d6910bbb-655d-44ad-842e-11da062a1e66/007.webp",
    rect: [201, 508, 24, 24],
    photoRadius: 12,
  },
  "assistant-dad-photo": {
    file: "flows/d6910bbb-655d-44ad-842e-11da062a1e66/005.webp",
    rect: [17, 467, 150, 150],
    photoRadius: 20,
    circularOcclusions: [[123, 123, 16]],
  },
  "assistant-merch-photo": {
    file: "flows/d6910bbb-655d-44ad-842e-11da062a1e66/005.webp",
    rect: [177, 467, 150, 150],
    photoRadius: 20,
    circularOcclusions: [[123, 123, 16]],
  },
  "assistant-armor-photo": {
    file: "flows/d6910bbb-655d-44ad-842e-11da062a1e66/007.webp",
    rect: [26, 504, 163, 163],
    photoRadius: 22,
    circularOcclusions: [
      [135, 135, 18],
      [49, 149, 3.5],
      [57, 149, 3.5],
      [65, 149, 3.5],
      [73, 149, 3.5],
      [81, 149, 3.5],
      [89, 149, 3.5],
      [97, 149, 3.5],
      [105, 149, 3.5],
      [113, 149, 3.5],
    ],
  },
  "order-peach-bee-photo": {
    file: "flows/e6c06e9f-26c9-476e-a3e5-d34c968eaa3d/003.webp",
    rect: [198, 458, 171, 171],
    photoRadius: 21,
    roundedOcclusions: [[10, 10, 51, 19, 9.5]],
    circularOcclusions: [[143, 143, 17]],
  },
  "order-drmtlgy-eye-photo": {
    file: "flows/e6c06e9f-26c9-476e-a3e5-d34c968eaa3d/003.webp",
    rect: [17, 458, 171, 171],
    photoRadius: 21,
    occlusions: [[10, 10, 57, 19]],
    circularOcclusions: [[143, 143, 17]],
  },
  "order-manual-picked-photo": {
    file: "flows/e6c06e9f-26c9-476e-a3e5-d34c968eaa3d/003.webp",
    rect: [17, 778, 359, 74],
    photoRadius: 20,
    // Exclude the native dock; only the bounded photographic header remains.
    roundedOcclusions: [[67, -16, 225, 60, 30]],
    circularOcclusions: [[29, 14, 31]],
  },
  "order-inspired-card-photo": {
    file: "flows/d3bf7c94-4d9e-4298-a255-eaf177f9efd1/010.webp",
    // Only the captured photographic header is available. Native navigation and
    // rating ink are removed and rendered as live DOM by the tracking surface.
    rect: [17, 760, 352, 92],
    roundedOcclusions: [[68, 3, 224, 59, 29.5]],
    lightTextOcclusions: [[283, 20, 69, 25]],
    circularOcclusions: [[29, 32, 30]],
    photoRadius: 28,
  },
  "order-inspired-next-fragment": {
    file: "flows/d3bf7c94-4d9e-4298-a255-eaf177f9efd1/010.webp",
    // The source reveals only this narrow leading edge of the next card.
    rect: [377, 760, 16, 92],
  },
  "order-deal-blue-bag": {
    file: "flows/8f406a69-ad1c-4de8-a699-12aa504efb74/006.webp",
    rect: [17, 304, 113, 113],
    photoRadius: 21,
    occlusions: [[10, 10, 51, 20]],
    circularOcclusions: [[85.5, 85.5, 17.5]],
  },
  "order-deal-dropper": {
    file: "flows/8f406a69-ad1c-4de8-a699-12aa504efb74/006.webp",
    rect: [140, 304, 113, 113],
    photoRadius: 21,
    occlusions: [[10, 10, 73, 20]],
    circularOcclusions: [[85.5, 85.5, 17.5]],
  },
  "order-deal-strawberry-balm": {
    file: "flows/8f406a69-ad1c-4de8-a699-12aa504efb74/006.webp",
    rect: [263, 304, 113, 113],
    photoRadius: 21,
    occlusions: [[10, 10, 51, 20]],
    circularOcclusions: [[85.5, 85.5, 17.5]],
  },
  "order-deal-white-treatment": {
    file: "flows/8f406a69-ad1c-4de8-a699-12aa504efb74/006.webp",
    rect: [17, 427, 113, 113],
    photoRadius: 21,
    occlusions: [[10, 10, 57, 20]],
    circularOcclusions: [[85.5, 85.5, 17.5]],
  },
  "order-deal-mascara": {
    file: "flows/8f406a69-ad1c-4de8-a699-12aa504efb74/006.webp",
    rect: [140, 427, 113, 113],
    photoRadius: 21,
    occlusions: [[10, 10, 57, 20]],
    circularOcclusions: [[85.5, 85.5, 17.5]],
  },
  "order-deal-hush": {
    file: "flows/8f406a69-ad1c-4de8-a699-12aa504efb74/006.webp",
    rect: [263, 427, 113, 113],
    photoRadius: 21,
    occlusions: [[10, 10, 57, 20]],
    circularOcclusions: [[85.5, 85.5, 17.5]],
  },
  "order-deal-carpe": {
    file: "flows/8f406a69-ad1c-4de8-a699-12aa504efb74/004.webp",
    rect: [263, 418, 113, 113],
    photoRadius: 21,
    occlusions: [[10, 10, 57, 20]],
    circularOcclusions: [[85.5, 85.5, 17.5]],
  },
  "home-carpe-wordmark": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/006.webp",
    // Brand ink only. The circular frame, card, labels and native dock are excluded.
    rect: [34, 792, 40, 19],
  },
  "home-campaign-princess-header": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/001.webp",
    rect: [17, 194, 359, 85],
    lightTextOcclusions: [
      [14, 21, 162, 25],
      [221, 24, 84, 19],
      [316, 28, 22, 10],
    ],
    textOcclusionMode: "inpaint",
    textOcclusionDilation: 1.5,
  },
  "home-campaign-princess-wordmark": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/001.webp",
    rect: [31, 215, 162, 25],
    lightWordmark: true,
  },
  "home-campaign-princess-top": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/001.webp",
    rect: [32, 280, 135, 135],
    roundedOcclusions: [
      [11, 11, 85, 19, 9.5],
      [90, 90, 34, 34, 17],
    ],
    roundedOcclusionFill: "vertical-gradient",
    photoRadius: 20,
  },
  "home-campaign-princess-dress": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/001.webp",
    rect: [175, 280, 135, 135],
    roundedOcclusions: [
      [11, 11, 49, 19, 9.5],
      [90, 90, 34, 34, 17],
    ],
    roundedOcclusionFill: "vertical-gradient",
    photoRadius: 20,
  },
  "home-campaign-princess-trailing": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/001.webp",
    rect: [318, 280, 75, 135],
    roundedOcclusions: [[11, 11, 49, 19, 9.5]],
    roundedOcclusionFill: "vertical-gradient",
  },
  "home-campaign-drmtlgy-header": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/001.webp",
    rect: [17, 519, 359, 67],
    lightTextOcclusions: [[21, 25, 153, 22]],
    darkTextOcclusions: [
      [234, 23, 73, 21],
      [316, 28, 22, 10],
    ],
    textOcclusionMode: "inpaint",
    textOcclusionDilation: 1.5,
  },
  "home-campaign-drmtlgy-wordmark": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/001.webp",
    rect: [38, 544, 153, 22],
    lightWordmark: true,
  },
  "home-campaign-drmtlgy-footer": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/004.webp",
    rect: [17, 474, 359, 69],
    darkTextOcclusions: [[13, 21, 108, 30]],
    textOcclusionMode: "inpaint",
    textOcclusionDilation: 1.5,
    roundedOcclusions: [[309, 19, 36, 36, 18]],
    roundedOcclusionFill: "vertical-gradient",
  },
  "home-campaign-drmtlgy-returning-photo": {
    // Only the exposed campaign photograph: remove every native product card,
    // heading and control, and stop before the captured dock. CSS blends its
    // bounded lower edge into the campaign tone beneath the live viewport fade.
    file: "flows/b5716e20-b094-463c-b74b-a5e983dd1651/009.webp",
    rect: [17, 271, 359, 493],
    lightTextOcclusions: [[19, 22, 157, 24]],
    darkTextOcclusions: [
      [228, 24, 78, 20],
      [315, 24, 26, 18],
    ],
    textOcclusionMode: "inpaint",
    textOcclusionDilation: 1.5,
    roundedOcclusionFill: "horizontal-gradient",
    roundedOcclusions: [
      [13, 60, 165, 155, 0],
      [182, 60, 164, 155, 0],
      [13, 219, 165, 155, 0],
      [182, 219, 164, 155, 0],
      [13, 378, 165, 155, 0],
      [182, 378, 164, 155, 0],
    ],
  },
  "home-campaign-drmtlgy-returning-wordmark": {
    file: "flows/b5716e20-b094-463c-b74b-a5e983dd1651/009.webp",
    rect: [38, 297, 153, 22],
    lightWordmark: true,
  },
  "home-campaign-tea-blue": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/005.webp",
    rect: [32, 195, 135, 128],
    roundedOcclusions: [
      [11, 10, 74, 21, 10.5],
      [90, 83, 34, 34, 17],
    ],
    roundedOcclusionFill: "vertical-gradient",
    photoRadius: 20,
  },
  "home-campaign-tea-orange": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/005.webp",
    rect: [175, 195, 135, 128],
    roundedOcclusions: [
      [11, 10, 73, 21, 10.5],
      [90, 83, 34, 34, 17],
    ],
    roundedOcclusionFill: "vertical-gradient",
    photoRadius: 20,
  },
  "home-campaign-tea-trailing": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/005.webp",
    rect: [318, 195, 75, 128],
    roundedOcclusions: [[7, 10, 61, 21, 10.5]],
    roundedOcclusionFill: "vertical-gradient",
  },
  "home-campaign-accessories-header": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/005.webp",
    rect: [17, 439, 359, 67],
    lightTextOcclusions: [
      [234, 24, 75, 20],
      [316, 28, 22, 10],
    ],
    textOcclusionMode: "inpaint",
    textOcclusionDilation: 1.5,
    photoRadius: 27,
  },
  "home-campaign-accessory-cap": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/005.webp",
    rect: [32, 506, 135, 135],
    roundedOcclusions: [
      [11, 11, 86, 21, 10.5],
      [90, 90, 34, 34, 17],
    ],
    roundedOcclusionFill: "vertical-gradient",
    photoRadius: 20,
  },
  "home-campaign-accessory-glasses": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/005.webp",
    rect: [175, 506, 135, 135],
    roundedOcclusions: [
      [11, 11, 109, 21, 10.5],
      [90, 90, 34, 34, 17],
    ],
    roundedOcclusionFill: "vertical-gradient",
    photoRadius: 20,
  },
  "home-campaign-accessory-trailing": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/005.webp",
    rect: [318, 506, 75, 135],
    roundedOcclusions: [[7, 11, 68, 21, 10.5]],
    roundedOcclusionFill: "vertical-gradient",
  },
  // Mountain tiles are full-bleed photographs with live controls over them.
  // Price pills and the captured dock region are removed; the corresponding
  // React controls render at the same positions.
  "home-campaign-mountain-pink": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/004.webp",
    rect: [32, 685, 135, 135],
    transparentRoundedOcclusions: [[54, 79, 222, 57, 28.5]],
    roundedOcclusions: [[11, 11, 44, 19, 9.5]],
    roundedOcclusionFill: "vertical-gradient",
  },
  "home-campaign-mountain-black": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/004.webp",
    rect: [175, 685, 135, 135],
    transparentRoundedOcclusions: [[-89, 79, 222, 57, 28.5]],
    roundedOcclusions: [[11, 11, 44, 19, 9.5]],
    roundedOcclusionFill: "vertical-gradient",
  },
  // Only this right sliver of the trailing photograph is captured. Its product
  // identity is unknown, so it decorates the existing store link, not an
  // invented product.
  "home-campaign-mountain-trailing": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/004.webp",
    rect: [318, 685, 75, 135],
    roundedOcclusions: [[11, 11, 49, 19, 9.5]],
    roundedOcclusionFill: "vertical-gradient",
  },
  "home-campaign-mountain-header": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/004.webp",
    rect: [17, 595, 359, 89],
    lightTextOcclusions: [
      [65, 17, 166, 40],
      [316, 32, 22, 10],
    ],
    textOcclusionMode: "inpaint",
    textOcclusionDilation: 1.5,
    circularOcclusions: [[37, 38, 23]],
  },
  "home-campaign-kitsch-header": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/006.webp",
    rect: [17, 115, 359, 59],
    lightTextOcclusions: [
      [11, 14, 137, 42],
      [219, 23, 95, 20],
      [316, 28, 22, 10],
    ],
    textOcclusionMode: "inpaint",
    textOcclusionDilation: 1.5,
  },
  "home-campaign-kitsch-footer": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/006.webp",
    rect: [17, 647, 359, 63],
    lightTextOcclusions: [[13, 18, 108, 29]],
    textOcclusionMode: "inpaint",
    textOcclusionDilation: 1.5,
    roundedOcclusions: [[309, 15, 36, 36, 18]],
    roundedOcclusionFill: "vertical-gradient",
  },
  "recent-kitsch-cover": {
    file: "flows/1cb8d743-c728-4317-8c60-1cc3c2761f8c/002.webp",
    rect: [17, 120, 173, 173],
    circularOcclusions: [[146, 27, 17]],
    photoRadius: 19,
  },
  "profile-recent-kitsch-cover": {
    file: "flows/cf77c541-39be-418c-91ef-2ca98f8d9f73/004.webp",
    rect: [17, 116, 110, 110],
    photoRadius: 23,
  },
  "recent-pura-cover": {
    file: "flows/1cb8d743-c728-4317-8c60-1cc3c2761f8c/002.webp",
    rect: [202, 493, 172, 172],
    circularOcclusions: [[145, 27, 17]],
    photoRadius: 19,
  },
  "recent-terracotta-photo": {
    file: "flows/1cb8d743-c728-4317-8c60-1cc3c2761f8c/002.webp",
    rect: [17, 493, 173, 173],
    occlusions: [[10, 11, 56, 18]],
    circularOcclusions: [
      [146, 27, 17],
      [146, 148, 17],
    ],
    photoRadius: 19,
  },
  "recent-drmtlgy-photo": {
    file: "flows/1cb8d743-c728-4317-8c60-1cc3c2761f8c/002.webp",
    rect: [202, 680, 172, 80],
    circularOcclusions: [[145, 27, 17]],
  },
  "home-recent-drmtlgy-cover": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/002.webp",
    rect: [201, 503, 160, 160],
    transparentRoundedOcclusions: [[11, 12, 57, 18, 9]],
    photoRadius: 19,
  },
  "recent-loaded-logo": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/005.webp",
    rect: [33, 137, 42, 42],
    photoRadius: 21,
  },
  "recent-jeans-conversation": {
    file: "flows/52c46d53-6d5f-4c10-964a-f9b0c404203c/003.webp",
    rect: [16, 331, 48, 49],
    photoRadius: 11,
  },
  "assistant-mobbin-merch-cap": {
    file: "flows/d6910bbb-655d-44ad-842e-11da062a1e66/005.webp",
    // Cap photography only, above the source card's heart control.
    rect: [192, 513, 108, 72],
    occlusions: [[99, 65, 9, 7]],
  },
  // Feedback uses a different photographic crop from the answer shelf.
  // Native vote controls are removed; the clean shelf photo fills only those
  // covered pixels, and both voting controls remain live DOM elements.
  "assistant-feedback-signature": {
    file: "flows/2e218159-702e-4708-b9aa-270dbca77f0b/002.webp",
    rect: [36, 481, 140, 141],
    photoRadius: 8,
    circularOcclusions: [
      [109, 59, 23],
      [109, 109, 23],
    ],
    underlayKey: "assistant-white-square",
  },
  "assistant-feedback-urban": {
    file: "flows/2e218159-702e-4708-b9aa-270dbca77f0b/002.webp",
    rect: [188, 481, 140, 141],
    photoRadius: 8,
    circularOcclusions: [
      [109, 59, 23],
      [109, 109, 23],
    ],
    underlayKey: "assistant-black-square",
  },
  "assistant-feedback-third-fragment": {
    file: "flows/2e218159-702e-4708-b9aa-270dbca77f0b/002.webp",
    // Only the photograph exposed before the feedback sheet's right edge.
    rect: [340, 481, 37, 141],
  },
  "assistant-white-square": {
    file: "flows/8b512345-0d92-4125-b037-4c6f05288cee/002.webp",
    rect: [18, 386, 148, 148],
    circularOcclusions: [[123, 121, 18]],
  },
  "assistant-black-square": {
    file: "flows/8b512345-0d92-4125-b037-4c6f05288cee/002.webp",
    rect: [178, 386, 148, 148],
    circularOcclusions: [[123, 121, 18]],
  },
  "assistant-city-square": {
    file: "flows/8b512345-0d92-4125-b037-4c6f05288cee/003.webp",
    rect: [26, 172, 162, 162],
    occlusions: [
      [8, 8, 58, 22],
      [48, 144, 56, 18],
    ],
    circularOcclusions: [[136, 136, 18]],
  },
  "assistant-signature-square": {
    file: "flows/8b512345-0d92-4125-b037-4c6f05288cee/003.webp",
    rect: [26, 372, 162, 162],
    occlusions: [[54, 144, 48, 18]],
    circularOcclusions: [[136, 136, 18]],
    underlayKey: "assistant-white-square",
  },
  "profile-empty-package": {
    file: "flows/cf77c541-39be-418c-91ef-2ca98f8d9f73/002.webp",
    rect: [32, 570, 66, 62],
  },
  "beauty-pill-skin": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/002.webp",
    rect: [20, 124, 32, 32],
  },
  "beauty-pill-hair": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/002.webp",
    rect: [142, 124, 32, 32],
  },
  "beauty-pill-makeup": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/002.webp",
    rect: [260, 124, 32, 32],
  },
  "beauty-pill-scent": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/002.webp",
    rect: [378, 124, 14, 32],
  },

  "auth-returning-package": {
    file: "flows/b5716e20-b094-463c-b74b-a5e983dd1651/002.webp",
    rect: [70, 375, 235, 176],
  },
  "auth-tracking-product": {
    file: "flows/b5716e20-b094-463c-b74b-a5e983dd1651/008.webp",
    rect: [52, 363, 80, 80],
  },
  "auth-tracking-package": {
    file: "flows/b5716e20-b094-463c-b74b-a5e983dd1651/008.webp",
    rect: [156, 363, 80, 80],
  },
  "auth-reference-avatar": {
    file: "flows/b5716e20-b094-463c-b74b-a5e983dd1651/007.webp",
    rect: [168, 183, 57, 57],
  },
  "connection-shop": {
    file: "flows/3d1f4110-721a-44e8-b35d-be4c015a9e03/003.webp",
    rect: [219, 230, 56, 56],
  },
  "connection-outlook": {
    file: "flows/3d1f4110-721a-44e8-b35d-be4c015a9e03/002.webp",
    rect: [58, 658, 25, 26],
  },
  "connection-amazon": {
    file: "flows/3d1f4110-721a-44e8-b35d-be4c015a9e03/002.webp",
    rect: [58, 735, 26, 26],
  },
  "order-empty-art": {
    file: "flows/8f406a69-ad1c-4de8-a699-12aa504efb74/002.webp",
    rect: [129, 155, 135, 234],
  },
  "order-deal-0": {
    file: "flows/8f406a69-ad1c-4de8-a699-12aa504efb74/004.webp",
    rect: [20, 330, 70, 50],
  },
  "order-deal-1": {
    file: "flows/8f406a69-ad1c-4de8-a699-12aa504efb74/004.webp",
    rect: [149, 324, 57, 66],
  },
  "order-deal-2": {
    file: "flows/8f406a69-ad1c-4de8-a699-12aa504efb74/004.webp",
    rect: [304, 329, 56, 42],
  },
  "order-deal-3": {
    file: "flows/8f406a69-ad1c-4de8-a699-12aa504efb74/004.webp",
    rect: [20, 447, 74, 41],
  },
  "order-deal-4": {
    file: "flows/8f406a69-ad1c-4de8-a699-12aa504efb74/004.webp",
    rect: [140, 450, 66, 55],
  },
  "order-deal-5": {
    file: "flows/8f406a69-ad1c-4de8-a699-12aa504efb74/004.webp",
    rect: [267, 452, 65, 48],
  },

  "checkout-shea-photo": {
    file: "flows/968f374e-69af-4adb-b913-0bb5c0e5e8b1/008.webp",
    rect: [15, 329, 62, 62],
    photoRadius: 12,
  },
  "checkout-rosemary-oil": {
    file: "flows/968f374e-69af-4adb-b913-0bb5c0e5e8b1/008.webp",
    rect: [15, 413, 62, 62],
    photoRadius: 12,
  },
  "checkout-white-rock-item": {
    file: "flows/968f374e-69af-4adb-b913-0bb5c0e5e8b1/007.webp",
    rect: [16, 651, 36, 36],
  },
  "connection-google": {
    file: "flows/3d1f4110-721a-44e8-b35d-be4c015a9e03/003.webp",
    rect: [130, 242, 32, 32],
  },
  "tracking-map-fragment": {
    file: "flows/d3bf7c94-4d9e-4298-a255-eaf177f9efd1/009.webp",
    rect: [0, 59, 140, 210],
  },
  "deals-rinse-logo": {
    file: "flows/7fd66949-219c-4ef9-ba53-a3482dbe2e60/002.webp",
    rect: [16, 179, 44, 44],
    photoRadius: 22,
  },
  "deals-rinse-tail": {
    file: "flows/7fd66949-219c-4ef9-ba53-a3482dbe2e60/002.webp",
    rect: [379, 240, 14, 171],
  },
  "deals-syman-tail": {
    file: "flows/7fd66949-219c-4ef9-ba53-a3482dbe2e60/002.webp",
    rect: [379, 573, 14, 171],
  },
  "deals-francesco-tail": {
    file: "flows/7fd66949-219c-4ef9-ba53-a3482dbe2e60/003.webp",
    rect: [379, 180, 14, 171],
  },
  "deals-solid-tail": {
    file: "flows/7fd66949-219c-4ef9-ba53-a3482dbe2e60/003.webp",
    rect: [379, 514, 14, 171],
  },
  "deals-rinse-tres": {
    file: "flows/7fd66949-219c-4ef9-ba53-a3482dbe2e60/002.webp",
    rect: [17, 240, 171, 171],
    photoRadius: 20,
    circularOcclusions: [[144, 144, 16]],
  },
  "deals-rinse-rainbow": {
    file: "flows/7fd66949-219c-4ef9-ba53-a3482dbe2e60/002.webp",
    rect: [198, 240, 171, 171],
    photoRadius: 20,
    circularOcclusions: [[144, 144, 16]],
  },
  "deals-syman-logo": {
    file: "flows/7fd66949-219c-4ef9-ba53-a3482dbe2e60/002.webp",
    rect: [16, 512, 44, 44],
    photoRadius: 22,
  },
  "deals-syman-fir": {
    file: "flows/7fd66949-219c-4ef9-ba53-a3482dbe2e60/002.webp",
    rect: [17, 573, 171, 171],
    photoRadius: 20,
    circularOcclusions: [[144, 144, 16]],
  },
  "deals-syman-lilac": {
    file: "flows/7fd66949-219c-4ef9-ba53-a3482dbe2e60/002.webp",
    rect: [198, 573, 171, 171],
    photoRadius: 20,
    circularOcclusions: [[144, 144, 16]],
  },
  "deals-francesco-logo": {
    file: "flows/7fd66949-219c-4ef9-ba53-a3482dbe2e60/003.webp",
    rect: [16, 120, 44, 44],
    photoRadius: 22,
  },
  "deals-francesco-goat": {
    file: "flows/7fd66949-219c-4ef9-ba53-a3482dbe2e60/003.webp",
    rect: [17, 180, 171, 171],
    photoRadius: 20,
    circularOcclusions: [[144, 144, 16]],
  },
  "deals-francesco-lavender": {
    file: "flows/7fd66949-219c-4ef9-ba53-a3482dbe2e60/003.webp",
    rect: [198, 180, 171, 171],
    photoRadius: 20,
    circularOcclusions: [[144, 144, 16]],
  },
  "deals-solid-logo": {
    file: "flows/7fd66949-219c-4ef9-ba53-a3482dbe2e60/003.webp",
    rect: [16, 452, 44, 44],
    photoRadius: 22,
  },
  "deals-solid-raquels": {
    file: "flows/7fd66949-219c-4ef9-ba53-a3482dbe2e60/003.webp",
    rect: [17, 514, 171, 171],
    photoRadius: 20,
    circularOcclusions: [[144, 144, 16]],
  },
  "deals-solid-mask": {
    file: "flows/7fd66949-219c-4ef9-ba53-a3482dbe2e60/003.webp",
    rect: [198, 514, 171, 171],
    photoRadius: 20,
    circularOcclusions: [[144, 144, 16]],
  },
  "home-drmtlgy-eye": {
    file: "flows/b5716e20-b094-463c-b74b-a5e983dd1651/009.webp",
    rect: [100, 339, 32, 134],
  },
  "home-returning-drmtlgy-retinol": {
    file: "flows/b5716e20-b094-463c-b74b-a5e983dd1651/009.webp",
    rect: [251, 333, 61, 150],
    // The native price overlaps this photograph; the live price owns that area.
    roundedOcclusions: [[-39, 12, 49, 17, 8.5]],
    roundedOcclusionFill: "vertical-gradient",
  },
  "home-drmtlgy-tinted": {
    file: "flows/b5716e20-b094-463c-b74b-a5e983dd1651/009.webp",
    rect: [93, 497, 36, 141],
  },
  "home-drmtlgy-bundle": {
    file: "flows/b5716e20-b094-463c-b74b-a5e983dd1651/009.webp",
    rect: [246, 500, 83, 140],
    occlusions: [
      [0, 0, 45, 24],
      [66, 104, 17, 36],
    ],
  },
  "home-drmtlgy-masks": {
    file: "flows/b5716e20-b094-463c-b74b-a5e983dd1651/009.webp",
    rect: [234, 664, 110, 136],
    occlusions: [
      [0, 0, 26, 18],
      [77, 93, 33, 37],
      [0, 99, 77, 37],
    ],
  },
  "home-princess-top": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/001.webp",
    rect: [33, 314, 89, 98],
  },
  "home-princess-dress": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/001.webp",
    rect: [176, 310, 94, 102],
  },
  "home-tea-blue": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/005.webp",
    rect: [33, 225, 89, 95],
  },
  "home-tea-orange": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/005.webp",
    rect: [176, 225, 92, 95],
  },
  "home-mountain-pink": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/004.webp",
    rect: [33, 712, 90, 49],
  },
  "home-mountain-black": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/004.webp",
    rect: [177, 719, 93, 41],
  },
  "home-accessory-cap": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/005.webp",
    rect: [45, 543, 110, 49],
  },
  "home-accessory-glasses": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/005.webp",
    rect: [177, 548, 125, 38],
  },
  "home-loaded-logo": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/005.webp",
    rect: [29, 133, 49, 49],
  },
  "home-mountain-logo": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/004.webp",
    rect: [32, 612, 44, 44],
  },
  "home-kitsch-photo": {
    file: "flows/8d7a8acd-de80-444e-93ba-65c61d7b6444/006.webp",
    rect: [17, 174, 359, 334],
  },
  "home-pura-photo": {
    file: "flows/5f25f0ee-f19a-49a8-8f9d-ca2f3259c3c6/002.webp",
    rect: [17, 174, 359, 332],
  },
  "home-pura-hidden-photo": {
    file: "flows/5f25f0ee-f19a-49a8-8f9d-ca2f3259c3c6/004.webp",
    rect: [16, 115, 361, 633],
    photoRadius: 28,
    lightTextOcclusions: [
      [166, 257, 30, 30],
      [80, 296, 201, 24],
    ],
    textOcclusionMode: "inpaint",
    textOcclusionDilation: 0.75,
    roundedOcclusions: [
      [143, 328, 76, 46, 23],
      [85, 591, 191, 44, 22],
    ],
    roundedOcclusionFill: "horizontal-gradient",
  },
  "home-pura-menu-header": {
    file: "flows/5f25f0ee-f19a-49a8-8f9d-ca2f3259c3c6/002.webp",
    rect: [17, 115, 359, 59],
    // Only brand/photography survives; live DOM supplies rating and More.
    roundedOcclusions: [
      [229, 22, 81, 18, 0],
      [315, 26, 26, 13, 0],
    ],
    roundedOcclusionFill: "vertical-gradient",
  },
  "home-pura-menu-wordmark": {
    file: "flows/5f25f0ee-f19a-49a8-8f9d-ca2f3259c3c6/002.webp",
    rect: [35, 130, 95, 38],
  },
  "home-pura-reason-photo": {
    file: "flows/5f25f0ee-f19a-49a8-8f9d-ca2f3259c3c6/003.webp",
    rect: [17, 174, 359, 332],
  },
  "home-pura-reason-header": {
    file: "flows/5f25f0ee-f19a-49a8-8f9d-ca2f3259c3c6/003.webp",
    rect: [17, 115, 359, 59],
  },
  "home-pura-reason-wordmark": {
    file: "flows/5f25f0ee-f19a-49a8-8f9d-ca2f3259c3c6/003.webp",
    rect: [35, 130, 95, 38],
  },
  "search-x721-photo": {
    file: "flows/4d0f0532-ce38-49b5-a94b-32e8ace4716c/006.webp",
    rect: [26, 397, 132, 132],
    circularOcclusions: [[103, 107, 17]],
    photoRadius: 20,
  },
  "search-tough-love-photo": {
    file: "flows/4d0f0532-ce38-49b5-a94b-32e8ace4716c/006.webp",
    rect: [26, 558, 132, 132],
    circularOcclusions: [[103, 107, 17]],
    photoRadius: 20,
  },
  "search-mmml-logo": {
    file: "flows/4d0f0532-ce38-49b5-a94b-32e8ace4716c/006.webp",
    rect: [171, 500, 26, 26],
    photoRadius: 13,
  },
  "suggestion-jeans-warehouse": {
    file: "flows/4d0f0532-ce38-49b5-a94b-32e8ace4716c/002.webp",
    rect: [16, 113, 44, 44],
  },
  "suggestion-city-jeans": {
    file: "flows/4d0f0532-ce38-49b5-a94b-32e8ace4716c/002.webp",
    rect: [13, 166, 50, 50],
  },

  "assistant-wide-one": {
    file: "flows/8b512345-0d92-4125-b037-4c6f05288cee/002.webp",
    rect: [17, 669, 150, 88],
  },
  "assistant-wide-two": {
    file: "flows/8b512345-0d92-4125-b037-4c6f05288cee/002.webp",
    rect: [179, 669, 148, 88],
  },
  "assistant-wide-partial": {
    file: "flows/8b512345-0d92-4125-b037-4c6f05288cee/002.webp",
    rect: [341, 669, 52, 88],
  },
  "assistant-blue-partial": {
    file: "flows/8b512345-0d92-4125-b037-4c6f05288cee/002.webp",
    rect: [341, 385, 51, 149],
  },
  "assistant-city-denim": {
    file: "flows/8b512345-0d92-4125-b037-4c6f05288cee/003.webp",
    rect: [78, 203, 66, 116],
  },

  "idea-rice-wash": {
    file: "flows/972c6dae-9ab4-4aaf-9f21-999808493dc6/002.webp",
    rect: [23, 157, 112, 106],
  },
  "idea-rosemary-bar": {
    file: "flows/972c6dae-9ab4-4aaf-9f21-999808493dc6/002.webp",
    rect: [208, 157, 112, 105],
  },
  "idea-rosemary-bundle": {
    file: "flows/972c6dae-9ab4-4aaf-9f21-999808493dc6/002.webp",
    rect: [24, 388, 121, 139],
  },
  "idea-purple-bundle": {
    file: "flows/972c6dae-9ab4-4aaf-9f21-999808493dc6/002.webp",
    rect: [209, 388, 119, 139],
  },
  "idea-rosemary-liquid": {
    file: "flows/972c6dae-9ab4-4aaf-9f21-999808493dc6/002.webp",
    rect: [34, 631, 109, 124],
  },
  "idea-jojoba": {
    file: "flows/972c6dae-9ab4-4aaf-9f21-999808493dc6/002.webp",
    rect: [209, 646, 113, 102],
  },

  "beauty-athena-deal": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/006.webp",
    rect: [17, 269, 171, 110],
  },
  "beauty-bestseller-continuation": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/006.webp",
    rect: [378, 59, 15, 64],
  },
  "beauty-deal-continuation": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/006.webp",
    rect: [378, 269, 15, 109],
  },
  "beauty-necessaire-deal": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/006.webp",
    rect: [197, 269, 171, 109],
  },
  "explore-womenswear-partial": {
    file: "flows/5c39eb04-f5fe-43a0-92da-b79b275051e0/004.webp",
    rect: [239, 820, 124, 30],
  },

  "beauty-starter-upper": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/003.webp",
    rect: [17, 394, 360, 140],
  },
  "beauty-starface-product": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/005.webp",
    rect: [45, 571, 119, 112],
  },
  "beauty-necessaire-product": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/005.webp",
    rect: [255, 570, 70, 120],
  },
  "beauty-perfume": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/004.webp",
    rect: [124, 165, 61, 33],
  },
  "beauty-bath": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/004.webp",
    rect: [214, 124, 32, 64],
  },
  "beauty-hair": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/004.webp",
    rect: [74, 265, 42, 24],
  },
  "beauty-nail": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/004.webp",
    rect: [320, 218, 30, 64],
  },
  "beauty-fenty-partial": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/006.webp",
    rect: [82, 38, 45, 60],
  },
  "beauty-juvia-partial": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/006.webp",
    rect: [244, 37, 70, 50],
  },

  "skin-card-anua": {
    file: "flows/01972be8-07ed-4dfa-9ec9-d1e6824c35bc/007.webp",
    rect: [16, 153, 173, 172],
    circularOcclusions: [[144, 143, 17]],
    photoRadius: 28,
  },
  "skin-card-mimi": {
    file: "flows/01972be8-07ed-4dfa-9ec9-d1e6824c35bc/007.webp",
    rect: [205, 153, 172, 172],
    circularOcclusions: [[143, 143, 17]],
    photoRadius: 28,
  },
  "skin-card-loretta": {
    file: "flows/01972be8-07ed-4dfa-9ec9-d1e6824c35bc/007.webp",
    rect: [16, 425, 173, 172],
    circularOcclusions: [[144, 144, 17]],
    photoRadius: 28,
  },
  "skin-card-harry": {
    file: "flows/01972be8-07ed-4dfa-9ec9-d1e6824c35bc/007.webp",
    rect: [205, 425, 172, 172],
    circularOcclusions: [[143, 144, 17]],
    photoRadius: 28,
  },
  "skin-loretta": {
    file: "flows/01972be8-07ed-4dfa-9ec9-d1e6824c35bc/007.webp",
    rect: [77, 433, 65, 159],
  },
  "skin-harry": {
    file: "flows/01972be8-07ed-4dfa-9ec9-d1e6824c35bc/007.webp",
    rect: [260, 439, 69, 147],
  },
  "skin-laundry-partial": {
    file: "flows/01972be8-07ed-4dfa-9ec9-d1e6824c35bc/007.webp",
    rect: [77, 697, 55, 153],
  },
  "skin-gopure-partial": {
    file: "flows/01972be8-07ed-4dfa-9ec9-d1e6824c35bc/007.webp",
    rect: [253, 704, 60, 144],
  },
  "skin-card-laundry-partial": {
    file: "flows/01972be8-07ed-4dfa-9ec9-d1e6824c35bc/007.webp",
    rect: [16, 697, 173, 155],
    photoRadius: 28,
    photoTopCornersOnly: true,
    circularOcclusions: [[144, 143, 17]],
  },
  "skin-card-gopure-partial": {
    file: "flows/01972be8-07ed-4dfa-9ec9-d1e6824c35bc/007.webp",
    rect: [205, 697, 172, 155],
    photoRadius: 28,
    photoTopCornersOnly: true,
    // Keep only exposed photograph pixels: Save and the fixed Home control
    // are independent DOM controls, never baked into this bounded fragment.
    circularOcclusions: [[143, 143, 17]],
    // The fixed Home control's shadow also belongs to that control. The
    // bounded blue backdrop begins beyond the bottle's right edge (x308),
    // so its exposed top/bottom edges can fill this control-only region.
    roundedOcclusions: [[103, 29, 69, 84, 34.5]],
    roundedOcclusionFill: "vertical-gradient",
  },
  "look-blazer-one-card": {
    file: "flows/d0dd4fc3-7ffe-4f1e-81d8-d2a17e904e24/008.webp",
    rect: [28, 181, 134, 134],
    circularOcclusions: [[105, 106, 17]],
  },
  "look-blazer-two-card": {
    file: "flows/d0dd4fc3-7ffe-4f1e-81d8-d2a17e904e24/008.webp",
    rect: [194, 181, 134, 134],
    circularOcclusions: [[105, 106, 17]],
  },
  "look-blazer-third-partial": {
    file: "flows/d0dd4fc3-7ffe-4f1e-81d8-d2a17e904e24/008.webp",
    rect: [360, 181, 33, 134],
  },
  "look-shirt-one-card": {
    file: "flows/d0dd4fc3-7ffe-4f1e-81d8-d2a17e904e24/008.webp",
    rect: [28, 492, 134, 134],
    circularOcclusions: [[105, 106, 17]],
  },
  "look-shirt-two-card": {
    file: "flows/d0dd4fc3-7ffe-4f1e-81d8-d2a17e904e24/008.webp",
    rect: [194, 492, 134, 134],
    circularOcclusions: [[105, 106, 17]],
  },
  "look-shirt-third-partial": {
    file: "flows/d0dd4fc3-7ffe-4f1e-81d8-d2a17e904e24/008.webp",
    rect: [360, 492, 33, 134],
  },
  "look-skirt-one-partial": {
    file: "flows/d0dd4fc3-7ffe-4f1e-81d8-d2a17e904e24/008.webp",
    rect: [30, 802, 129, 48],
  },
  "look-skirt-two-partial": {
    file: "flows/d0dd4fc3-7ffe-4f1e-81d8-d2a17e904e24/008.webp",
    rect: [198, 802, 128, 48],
  },
  "look-skirt-three-partial": {
    file: "flows/d0dd4fc3-7ffe-4f1e-81d8-d2a17e904e24/008.webp",
    rect: [360, 802, 33, 48],
  },
  "beauty-nails-photo": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/006.webp",
    rect: [16, 495, 353, 198],
    photoRadius: 28,
    lightTextOcclusions: [
      [19, 140, 222, 25],
      [19, 164, 272, 18],
    ],
    textOcclusionMode: "inpaint",
    circularOcclusions: [[317, 163, 17]],
  },
  "beauty-athena-product": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/004.webp",
    rect: [65, 510, 76, 123],
  },
  "beauty-crown-product": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/004.webp",
    rect: [263, 499, 51, 124],
  },

  "pdp-kitsch-art": {
    file: "flows/a99e7161-595d-466c-b0b1-bc1183f1d4d7/008.webp",
    rect: [16, 74, 361, 135],
  },
  "saved-socks": {
    file: "flows/75b26fee-826f-4403-9288-be499890cd72/002.webp",
    rect: [162, 259, 70, 125],
  },
  "shea-gallery-hero": { file: "screens/066.webp", rect: [0, 230, 393, 393] },
  "shea-gallery-testimonial": {
    file: "screens/067.webp",
    rect: [0, 230, 393, 393],
  },
  "shea-gallery-benefits": {
    file: "screens/060.webp",
    rect: [16, 119, 361, 361],
  },
  "following-quilt": { file: "screens/024.webp", rect: [18, 438, 357, 286] },
  "following-bow": { file: "screens/026.webp", rect: [29, 290, 339, 134] },
  "qbp-logo": { file: "screens/024.webp", rect: [19, 348, 40, 40] },
  "pura-amber": { file: "screens/025.webp", rect: [32, 314, 113, 126] },
  "pura-mandarin": { file: "screens/025.webp", rect: [220, 314, 110, 127] },
  "pura-cashmere": { file: "screens/025.webp", rect: [32, 549, 112, 129] },
  "pura-charcoal": { file: "screens/025.webp", rect: [218, 549, 113, 129] },

  // Isolated icon fragments only; no unseen Mini name or destination is inferred.
  "minis-snap-gem-icon-fragment": {
    file: "flows/5fc61632-627a-4875-883e-7cfea2bae666/002.webp",
    rect: [362, 446, 31, 44],
  },
  "minis-snap-cat-icon-fragment": {
    file: "flows/5fc61632-627a-4875-883e-7cfea2bae666/002.webp",
    rect: [362, 502, 31, 44],
  },
  "minis-space-script-icon-fragment": {
    file: "flows/5fc61632-627a-4875-883e-7cfea2bae666/002.webp",
    rect: [362, 674, 31, 44],
  },
  "minis-space-room-icon-fragment": {
    file: "flows/5fc61632-627a-4875-883e-7cfea2bae666/002.webp",
    rect: [362, 730, 31, 44],
  },
  "category-combo-partial": {
    file: "screens/124.webp",
    rect: [23, 733, 158, 118],
  },
  "category-hair-partial": {
    file: "screens/124.webp",
    rect: [211, 733, 158, 118],
  },
  "detox-shampoo": {
    file: "flows/1df75dd0-05f6-445c-9709-0e0bda2df3af/003.webp",
    rect: [17, 236, 41, 41],
  },
  "rice-liquid": {
    file: "flows/1df75dd0-05f6-445c-9709-0e0bda2df3af/004.webp",
    rect: [73, 448, 70, 160],
  },
  "rosemary-liquid": {
    file: "flows/1df75dd0-05f6-445c-9709-0e0bda2df3af/004.webp",
    rect: [256, 210, 72, 149],
  },
  "rosemary-bar": {
    file: "flows/1df75dd0-05f6-445c-9709-0e0bda2df3af/003.webp",
    rect: [17, 292, 41, 41],
  },

  "store-shop-all": { file: "screens/125.webp", rect: [22, 130, 349, 175] },
  "store-kitsch-terracotta-recommendation": {
    file: "flows/e85d0150-4fe9-4ee0-bde4-de17fe6da7df/001.webp",
    rect: [175, 193, 135, 135],
    circularOcclusions: [[107, 107, 17]],
    photoRadius: 20,
  },
  "collection-new-hero": {
    file: "flows/e85d0150-4fe9-4ee0-bde4-de17fe6da7df/002.webp",
    rect: [0, 103, 393, 246],
    darkTextOcclusions: [
      [15, 185, 145, 40],
      [44, 222, 76, 24],
      [348, 187, 35, 39],
    ],
    darkTextThreshold: 128,
    textOcclusionDilation: 1,
    textOcclusionMode: "inpaint",
    circularOcclusions: [[29, 235, 15]],
  },
  "collection-yellow-partial": {
    file: "screens/050.webp",
    rect: [20, 680, 165, 81],
  },
  "collection-coffee-partial": {
    file: "screens/050.webp",
    rect: [208, 680, 165, 81],
  },
  "collection-new-summer-card": {
    file: "flows/e85d0150-4fe9-4ee0-bde4-de17fe6da7df/002.webp",
    rect: [16, 425, 175, 173],
    occlusions: [[12, 10, 52, 20]],
    roundedOcclusions: [[130, 128, 34, 34, 17]],
    roundedOcclusionFill: "vertical-gradient",
    photoRadius: 20,
  },
  "collection-new-gelato-card": {
    file: "flows/e85d0150-4fe9-4ee0-bde4-de17fe6da7df/002.webp",
    rect: [202, 425, 175, 173],
    roundedOcclusions: [[130, 128, 34, 34, 17]],
    roundedOcclusionFill: "vertical-gradient",
    photoRadius: 20,
  },
  "sol-welcome-left": {
    file: "flows/2f492f6c-2db7-440b-8515-aa56a2d029e5/003.webp",
    rect: [0, 103, 121, 174],
  },
  "sol-welcome-art": {
    // Decorative photos, gradient and Sol brand mark; ends before the DOM heading.
    file: "flows/2f492f6c-2db7-440b-8515-aa56a2d029e5/003.webp",
    rect: [0, 103, 393, 300],
  },
  "sol-welcome-loading-art": {
    // Source frame 002 records the Mini access sheet before remote artwork resolves.
    file: "flows/2f492f6c-2db7-440b-8515-aa56a2d029e5/002.webp",
    rect: [0, 103, 393, 300],
  },
  "sol-welcome-permission-art": {
    // Source frame 004 has a distinct product rotation behind the permission sheet.
    file: "flows/2f492f6c-2db7-440b-8515-aa56a2d029e5/004.webp",
    rect: [0, 103, 393, 300],
  },
  "sol-welcome-right": {
    file: "flows/2f492f6c-2db7-440b-8515-aa56a2d029e5/003.webp",
    rect: [262, 177, 131, 207],
  },
  "sol-welcome-lower-left": {
    file: "flows/2f492f6c-2db7-440b-8515-aa56a2d029e5/003.webp",
    rect: [0, 486, 66, 134],
  },
  "sol-welcome-loading-lower-left": {
    file: "flows/2f492f6c-2db7-440b-8515-aa56a2d029e5/002.webp",
    rect: [0, 486, 66, 134],
  },
  "sol-welcome-lower-right": {
    file: "flows/2f492f6c-2db7-440b-8515-aa56a2d029e5/003.webp",
    rect: [323, 577, 70, 102],
  },
  "sol-welcome-loading-lower-right": {
    file: "flows/2f492f6c-2db7-440b-8515-aa56a2d029e5/002.webp",
    rect: [323, 577, 70, 102],
  },
  "sol-welcome-permission-lower-left": {
    file: "flows/2f492f6c-2db7-440b-8515-aa56a2d029e5/004.webp",
    rect: [0, 486, 66, 134],
  },
  "sol-welcome-permission-lower-right": {
    file: "flows/2f492f6c-2db7-440b-8515-aa56a2d029e5/004.webp",
    rect: [323, 577, 70, 102],
  },

  "store-review-1": { file: "screens/128.webp", rect: [33, 252, 63, 63] },
  "store-review-2": { file: "screens/128.webp", rect: [33, 489, 63, 63] },
  "store-review-3": { file: "screens/128.webp", rect: [33, 726, 63, 63] },

  "collection-new": { file: "screens/124.webp", rect: [23, 502, 158, 161] },
  "collection-new-tile": {
    file: "screens/047.webp",
    rect: [36.6667, 477, 126, 126],
    photoRadius: 20,
  },
  "collection-best-tile": {
    file: "screens/047.webp",
    rect: [179.6667, 477, 126, 126],
    photoRadius: 20,
  },
  "collection-best": { file: "screens/047.webp", rect: [179, 479, 126, 124] },
  "category-cleanse": { file: "screens/124.webp", rect: [23, 290, 158, 161] },
  "category-heatless": { file: "screens/124.webp", rect: [211, 290, 158, 161] },
  "category-caps": { file: "screens/124.webp", rect: [211, 502, 158, 161] },
  "sol-flower": { file: "screens/184.webp", rect: [175, 138, 44, 43] },
  "chemical-poster": { file: "screens/052.webp", rect: [0, 163, 393, 494] },
  "chemical-card1": { file: "screens/048.webp", rect: [42, 297, 111, 63] },
  "chemical-card2": { file: "screens/048.webp", rect: [188, 297, 102, 61] },
  "chemical-rail1": { file: "screens/048.webp", rect: [18, 478, 105, 128] },
  "chemical-rail2": { file: "screens/048.webp", rect: [134, 478, 105, 128] },
  "chemical-rail3": { file: "screens/048.webp", rect: [252, 478, 105, 128] },
  "summer-tight": { file: "screens/050.webp", rect: [42, 458, 113, 128] },
  "assistant-white": {
    file: "flows/2e218159-702e-4708-b9aa-270dbca77f0b/001.webp",
    rect: [67, 371, 78, 145],
  },
  "assistant-black": {
    file: "flows/2e218159-702e-4708-b9aa-270dbca77f0b/002.webp",
    rect: [223, 481, 45, 138],
  },
  "mini-sol-hero": { file: "screens/174.webp", rect: [26, 129, 334, 175] },
  "mini-skin-hero": { file: "screens/176.webp", rect: [25, 129, 336, 175] },
  "mini-look-hero": { file: "screens/177.webp", rect: [25, 129, 336, 175] },
  "mini-gift-hero": { file: "screens/178.webp", rect: [33, 129, 335, 175] },
  "mini-sol-icon": { file: "screens/176.webp", rect: [16, 444, 72, 72] },
  "mini-skin-icon": { file: "screens/177.webp", rect: [16, 444, 72, 72] },
  "skin-permission-avatar": {
    file: "flows/01972be8-07ed-4dfa-9ec9-d1e6824c35bc/003.webp",
    rect: [293, 676, 36, 36],
    photoRadius: 18,
  },
  "mini-look-icon": { file: "screens/178.webp", rect: [16, 444, 72, 72] },
  "mini-gift-icon": { file: "screens/178.webp", rect: [41, 316, 44, 44] },
  "mini-room-icon": { file: "screens/174.webp", rect: [16, 502, 44, 44] },
  "mini-color-icon": { file: "screens/174.webp", rect: [16, 558, 44, 44] },
  "mini-decor-icon": { file: "screens/174.webp", rect: [16, 674, 44, 44] },
  "explore-summer-upper": {
    file: "flows/5c39eb04-f5fe-43a0-92da-b79b275051e0/002.webp",
    rect: [16, 119, 353, 200],
    lightTextOcclusions: [
      [20, 140, 274, 28],
      [20, 166, 250, 21],
    ],
    textOcclusionDilation: 0.75,
    textOcclusionMode: "inpaint",
    circularOcclusions: [[317, 164, 18]],
    photoRadius: 28,
  },
  "explore-summer-continuation": {
    file: "flows/5c39eb04-f5fe-43a0-92da-b79b275051e0/002.webp",
    rect: [378, 119, 15, 200],
  },
  "explore-beauty-continuation": {
    file: "flows/5c39eb04-f5fe-43a0-92da-b79b275051e0/004.webp",
    rect: [378, 432, 15, 170],
    roundedOcclusions: [[11, 10, 58, 20, 10]],
  },
  "explore-home-continuation": {
    file: "flows/5c39eb04-f5fe-43a0-92da-b79b275051e0/003.webp",
    rect: [378, 371, 15, 172],
    // Only the observed photograph fragment. Remove the clipped native badge;
    // its undisclosed discount and product identity are not invented.
    roundedOcclusions: [[11, 11, 58, 20, 10]],
  },
  "first-collection-rice-photo": {
    file: "flows/e85d0150-4fe9-4ee0-bde4-de17fe6da7df/003.webp",
    // Product photograph inside the decorative stack only. Its native heart
    // is excluded; the shared DOM heart remains responsible for that artwork.
    rect: [128, 516, 110, 98],
    circularOcclusions: [[100, 83, 15]],
  },
  "explore-menswear-continuation": {
    file: "flows/5c39eb04-f5fe-43a0-92da-b79b275051e0/004.webp",
    rect: [378, 111, 15, 172],
  },
  "beauty-new-continuation": {
    file: "flows/3fd0a145-a819-409f-a853-c6b03e2e2d27/003.webp",
    rect: [378, 111, 15, 170],
    roundedOcclusions: [[11, 10, 58, 20, 10]],
  },
  "explore-curls-upper": {
    file: "screens/169.webp",
    rect: [32, 204, 329, 132],
  },
  "explore-deals-art": { file: "screens/166.webp", rect: [17, 422, 174, 80] },
  "explore-beauty-lip": { file: "screens/166.webp", rect: [209, 425, 76, 76] },
  "explore-beauty-wash": { file: "screens/166.webp", rect: [293, 425, 76, 76] },
  "explore-women-shirt": { file: "screens/166.webp", rect: [25, 556, 76, 76] },
  "explore-women-jeans": { file: "screens/166.webp", rect: [109, 556, 76, 76] },
  "explore-men-shirt": { file: "screens/166.webp", rect: [209, 556, 76, 76] },
  "explore-men-jeans": { file: "screens/166.webp", rect: [293, 556, 76, 76] },
  "explore-home-lamp": { file: "screens/166.webp", rect: [25, 687, 76, 76] },
  "explore-home-pan": { file: "screens/166.webp", rect: [109, 687, 76, 76] },
  "explore-fitness-tone": {
    file: "screens/166.webp",
    rect: [209, 687, 76, 76],
  },
  "explore-fitness-shorts": {
    file: "screens/166.webp",
    rect: [293, 687, 76, 76],
  },
  "look-outfit-inner": { file: "screens/201.webp", rect: [104, 375, 188, 288] },
  "look-outfit-results": {
    file: "flows/d0dd4fc3-7ffe-4f1e-81d8-d2a17e904e24/006.webp",
    rect: [47, 230, 299, 450],
    underlayKey: "look-outfit-results-underlay",
    // Native labels, rings and their shadows are excluded from the photograph.
    roundedOcclusions: [
      [0, 177, 172, 31, 3],
      [128, 140, 171, 31, 3],
      [126, 217, 173, 31, 3],
      [135, 336, 164, 31, 3],
    ],
  },
  "look-outfit-results-underlay": {
    file: "screens/201.webp",
    rect: [84, 355, 224, 328],
    rotateDegrees: -3,
    postRotateRect: [20, 19, 201, 304],
  },
  "whip-mousse": { file: "screens/169.webp", rect: [86, 477, 32, 157] },
  "hanacure-cleanser": { file: "screens/169.webp", rect: [228, 505, 99, 111] },
  "bubble-sunrise": { file: "screens/168.webp", rect: [69, 506, 70, 90] },
  "bare-liquid": { file: "screens/168.webp", rect: [225, 462, 100, 116] },
  "carbon-crew": { file: "screens/168.webp", rect: [57, 141, 90, 139] },
  "jordan-legend": { file: "screens/168.webp", rect: [200, 170, 124, 88] },
  "buffy-breeze": { file: "screens/167.webp", rect: [18, 378, 120, 146] },
  "citizenry-linen": { file: "screens/167.webp", rect: [205, 403, 116, 94] },
  "explore-home-buffy-card": {
    file: "flows/5c39eb04-f5fe-43a0-92da-b79b275051e0/003.webp",
    rect: [16, 371, 173, 172],
    roundedOcclusions: [[127.5, 127, 34, 34, 17]],
    roundedOcclusionFill: "vertical-gradient",
    photoRadius: 20,
  },
  "explore-home-citizenry-card": {
    file: "flows/5c39eb04-f5fe-43a0-92da-b79b275051e0/003.webp",
    rect: [197, 371, 172, 172],
    roundedOcclusions: [
      [11, 11, 49, 18, 9],
      [127.5, 127, 34, 34, 17],
    ],
    roundedOcclusionFill: "vertical-gradient",
    photoRadius: 20,
  },
  "explore-home-carbon-card": {
    file: "flows/5c39eb04-f5fe-43a0-92da-b79b275051e0/004.webp",
    rect: [16, 111, 173, 172],
    roundedOcclusions: [
      [12, 11, 57, 20, 10],
      [127.5, 127, 34, 34, 17],
    ],
    roundedOcclusionFill: "vertical-gradient",
    photoRadius: 20,
  },
  "explore-home-jordan-card": {
    file: "flows/5c39eb04-f5fe-43a0-92da-b79b275051e0/004.webp",
    rect: [197, 111, 172, 172],
    roundedOcclusions: [[127.5, 127, 34, 34, 17]],
    roundedOcclusionFill: "vertical-gradient",
    photoRadius: 20,
  },
  "explore-home-bubble-card": {
    file: "flows/5c39eb04-f5fe-43a0-92da-b79b275051e0/004.webp",
    rect: [16, 431, 173, 172],
    roundedOcclusions: [[127.5, 127, 34, 34, 17]],
    roundedOcclusionFill: "vertical-gradient",
    photoRadius: 20,
  },
  "explore-home-bare-card": {
    file: "flows/5c39eb04-f5fe-43a0-92da-b79b275051e0/004.webp",
    rect: [197, 431, 172, 172],
    roundedOcclusions: [
      [12, 11, 57, 20, 10],
      [127.5, 127, 34, 34, 17],
    ],
    roundedOcclusionFill: "vertical-gradient",
    photoRadius: 20,
  },
  "sol-tan-cap": { file: "screens/190.webp", rect: [75, 444, 109, 99] },
  "sol-boston-cap": { file: "screens/190.webp", rect: [204, 429, 120, 92] },
  "skin-anua": { file: "screens/196.webp", rect: [75, 550, 56, 135] },
  "skin-mimi": { file: "screens/196.webp", rect: [267, 553, 48, 125] },
  "gift-logic": { file: "screens/214.webp", rect: [40, 293, 64, 65] },
  "gift-buds": { file: "screens/214.webp", rect: [49, 393, 47, 63] },
  "gift-nirvana": { file: "screens/214.webp", rect: [50, 497, 47, 57] },
  "look-sculpt": { file: "screens/204.webp", rect: [52, 183, 64, 130] },
  "look-aven": { file: "screens/204.webp", rect: [238, 185, 44, 126] },
  "look-black-crew": { file: "screens/204.webp", rect: [55, 493, 63, 129] },
  "look-white-crew": { file: "screens/204.webp", rect: [225, 493, 56, 130] },
  shea: { file: "screens/059.webp", rect: [16, 119, 361, 361] },
  "shea-detail": { file: "screens/060.webp", rect: [24, 119, 361, 361] },
  "shea-photo": { file: "screens/066.webp", rect: [0, 230, 393, 393] },
  "kitsch-logo": { file: "screens/059.webp", rect: [16, 68, 44, 44] },
  "vehla-logo": { file: "screens/017.webp", rect: [32, 612, 44, 44] },
  "pura-logo": { file: "screens/027.webp", rect: [16, 187, 44, 44] },
  avatar: { file: "screens/017.webp", rect: [16, 59, 40, 40] },
  parcel: { file: "screens/017.webp", rect: [33, 211, 32, 25] },
  "deal-tag": { file: "screens/059.webp", rect: [31, 611, 31, 33] },
  "dress-deal-tag": {
    file: "flows/a99e7161-595d-466c-b0b1-bc1183f1d4d7/005.webp",
    rect: [33, 252, 32, 33],
  },
  cleo: { file: "screens/017.webp", rect: [42, 390, 115, 61] },
  "round-sunglasses": { file: "screens/017.webp", rect: [185, 390, 115, 61] },
  "shampoo-bag": { file: "screens/072.webp", rect: [30, 416, 85, 87] },
  terracotta: { file: "screens/045.webp", rect: [322, 548, 69, 120] },
  "rice-shampoo": { file: "screens/130.webp", rect: [16, 179, 44, 44] },
  "rice-conditioner": { file: "screens/049.webp", rect: [217, 192, 103, 120] },
  rosemary: { file: "screens/131.webp", rect: [254, 205, 74, 157] },
  "fashion-logo": {
    file: "flows/4d0f0532-ce38-49b5-a94b-32e8ace4716c/004.webp",
    rect: [174, 480, 22, 22],
  },
  "origin-logo": {
    file: "flows/4d0f0532-ce38-49b5-a94b-32e8ace4716c/004.webp",
    rect: [173, 640, 26, 26],
  },
  fitjeans: {
    file: "flows/4d0f0532-ce38-49b5-a94b-32e8ace4716c/004.webp",
    rect: [20, 164, 164, 115],
  },
  "preference-bottle": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/009.webp",
    rect: [0, 107, 51, 111],
  },
  "preference-vest": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/009.webp",
    rect: [60, 83, 85, 110],
  },
  "preference-woman": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/009.webp",
    rect: [155, 18, 85, 111],
  },
  "preference-game": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/009.webp",
    rect: [249, 69, 84, 110],
  },
  "preference-lotion": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/009.webp",
    rect: [343, 116, 50, 110],
  },
  "preference-robe": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/009.webp",
    rect: [0, 227, 51, 110],
  },
  "preference-camera": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/009.webp",
    rect: [60, 204, 85, 110],
  },
  "preference-man": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/009.webp",
    rect: [155, 139, 85, 110],
  },
  "preference-coat": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/009.webp",
    rect: [249, 190, 84, 110],
  },
  "preference-shoe": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/009.webp",
    rect: [155, 259, 85, 110],
  },
  "preference-bear": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/009.webp",
    rect: [343, 242, 50, 97],
  },
  "shop-wordmark": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/002.webp",
    rect: [137, 389, 123, 51],
  },
  "auth-loop": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/004.webp",
    rect: [181, 140, 32, 34],
  },
  "widget-kitsch-logo": {
    file: "flows/403ffb92-8c6c-4117-8d75-21555bb8db42/001.webp",
    rect: [42, 659, 56, 56],
  },
  "widget-shop-mark": {
    file: "flows/403ffb92-8c6c-4117-8d75-21555bb8db42/001.webp",
    rect: [335, 98, 16, 17],
  },
  "widget-dhl-logo": {
    file: "flows/403ffb92-8c6c-4117-8d75-21555bb8db42/001.webp",
    rect: [42, 269, 32, 33],
  },
  // Brand artwork only from f068-004; carrier labels and rows remain DOM.
  "order-carrier-active-tracing": {
    file: "flows/bdd3954f-d943-464a-8c57-6621ffba7fa6/004.webp",
    rect: [311, 467, 50, 50],
  },
  "order-carrier-benelux": {
    file: "flows/bdd3954f-d943-464a-8c57-6621ffba7fa6/004.webp",
    rect: [311, 534, 50, 50],
  },
  "order-carrier-two-man": {
    file: "flows/bdd3954f-d943-464a-8c57-6621ffba7fa6/004.webp",
    rect: [311, 601, 50, 50],
  },
  "order-carrier-ecommerce": {
    file: "flows/bdd3954f-d943-464a-8c57-6621ffba7fa6/004.webp",
    rect: [311, 668, 50, 50],
  },
  "order-carrier-spain": {
    file: "flows/bdd3954f-d943-464a-8c57-6621ffba7fa6/004.webp",
    rect: [311, 802, 50, 50],
  },
  "sol-glasses-model": {
    file: "flows/ae7711ef-6c54-4aa1-bb56-bee25cf3bef7/003.webp",
    rect: [60, 423, 130, 132],
  },
  "sol-glasses-dark": {
    file: "flows/ae7711ef-6c54-4aa1-bb56-bee25cf3bef7/003.webp",
    rect: [205, 444, 121, 62],
  },
  "skin-symbol": {
    file: "flows/01972be8-07ed-4dfa-9ec9-d1e6824c35bc/002.webp",
    rect: [177, 267, 40, 41],
  },
  "look-wordmark": {
    file: "flows/d0dd4fc3-7ffe-4f1e-81d8-d2a17e904e24/003.webp",
    rect: [59, 198, 277, 225],
    pinkChromaKey: true,
  },
  "assistant-uploaded-cap": {
    // The selected photo, tightly bounded inside its DOM thumbnail control.
    file: "flows/d6910bbb-655d-44ad-842e-11da062a1e66/003.webp",
    rect: [81, 503, 17, 16],
  },
  "assistant-cap": {
    file: "flows/d6910bbb-655d-44ad-842e-11da062a1e66/007.webp",
    rect: [49, 330, 96, 112],
  },
  "assistant-armor-cap": {
    file: "flows/d6910bbb-655d-44ad-842e-11da062a1e66/007.webp",
    rect: [39, 522, 106, 99],
  },
  "discover-hat": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/003.webp",
    rect: [46, 233, 105, 122],
  },
  "discover-basket": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/003.webp",
    rect: [177, 188, 78, 64],
  },
  "discover-calculator": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/003.webp",
    rect: [320, 208, 47, 51],
  },
  "discover-watering": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/003.webp",
    rect: [328, 306, 65, 113],
  },
  "discover-ball": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/003.webp",
    rect: [102, 511, 92, 91],
  },
  "discover-chair": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/003.webp",
    rect: [6, 505, 51, 79],
  },
  "discover-candle": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/003.webp",
    rect: [234, 568, 53, 66],
  },
  "discover-lipstick": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/003.webp",
    rect: [314, 468, 51, 92],
  },
  "discover-clock": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/003.webp",
    rect: [0, 335, 63, 90],
  },
  "onboarding-delivered-parcel": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/015.webp",
    rect: [300, 419, 62, 49],
  },
  "auth-email-phone": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/006.webp",
    rect: [179, 165, 36, 72],
  },
  "auth-passkey": {
    file: "flows/b5716e20-b094-463c-b74b-a5e983dd1651/006.webp",
    rect: [179, 165, 36, 72],
  },
  "auth-phone": {
    file: "flows/b5716e20-b094-463c-b74b-a5e983dd1651/003.webp",
    rect: [179, 165, 36, 72],
  },
  "intro-chair": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/002.webp",
    rect: [180, 143, 51, 82],
  },
  "intro-clock": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/002.webp",
    rect: [278, 214, 80, 81],
  },
  "intro-ball": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/002.webp",
    rect: [58, 247, 93, 92],
  },
  "intro-candle": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/002.webp",
    rect: [0, 334, 38, 64],
  },
  "intro-hat": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/002.webp",
    rect: [330, 357, 63, 102],
  },
  "intro-lipstick": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/002.webp",
    rect: [0, 465, 81, 69],
  },
  "intro-watering": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/002.webp",
    rect: [84, 532, 127, 115],
  },
  "intro-basket": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/002.webp",
    rect: [308, 509, 76, 68],
  },
  "intro-calculator": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/002.webp",
    rect: [246, 606, 49, 52],
  },
  "onboarding-package": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/011.webp",
    rect: [159, 374, 70, 60],
  },
  "onboarding-shoe": {
    file: "flows/b778fdce-2c65-4153-aaee-6703098f27d4/011.webp",
    rect: [53, 365, 80, 80],
  },
  "brush-detail": { file: "screens/045.webp", rect: [0, 184, 393, 161] },
  "search-filter-arrow-store": {
    file: "flows/0344c453-dece-4e8d-bb54-68f6e551b83f/010.webp",
    rect: [16, 163, 174, 190],
    occlusions: [
      [10, 121, 68, 23],
      [0, 144, 174, 46],
    ],
    photoRadius: 22,
  },
  "search-filter-american-store": {
    file: "flows/0344c453-dece-4e8d-bb54-68f6e551b83f/010.webp",
    rect: [197, 163, 174, 190],
    occlusions: [
      [10, 121, 78, 23],
      [0, 144, 174, 46],
    ],
    photoRadius: 22,
  },
  "search-filter-store-continuation": {
    file: "flows/0344c453-dece-4e8d-bb54-68f6e551b83f/010.webp",
    rect: [377, 163, 16, 190],
  },
  "search-filter-valentino": {
    file: "flows/0344c453-dece-4e8d-bb54-68f6e551b83f/010.webp",
    rect: [24, 376, 133, 133],
    circularOcclusions: [[107, 107, 17]],
    photoRadius: 20,
  },
  "search-filter-lusoophy": {
    file: "flows/0344c453-dece-4e8d-bb54-68f6e551b83f/010.webp",
    rect: [161, 466, 36, 36],
    photoRadius: 18,
  },
  "search-filter-givenchy": {
    file: "flows/0344c453-dece-4e8d-bb54-68f6e551b83f/010.webp",
    rect: [24, 585, 133, 110],
  },
  // These are photograph interiors from the longer source entry. Captured
  // navigation is removed, never painted as interface or assigned to a SKU.
  "store-arrival-tail-left": {
    file: "flows/a99e7161-595d-466c-b0b1-bc1183f1d4d7/001.webp",
    rect: [16, 692, 175, 160],
    photoRadius: 20,
    roundedOcclusions: [
      [1, 72, 56, 57, 28],
      [70, 72, 222, 57, 28],
    ],
  },
  "store-arrival-tail-right": {
    file: "flows/a99e7161-595d-466c-b0b1-bc1183f1d4d7/001.webp",
    rect: [203, 692, 175, 160],
    photoRadius: 20,
    roundedOcclusions: [[-117, 72, 222, 57, 28]],
  },
  "store-source-tail-left": {
    file: "flows/85a58afb-b3e8-4f69-b274-69762b09ffbf/005.webp",
    rect: [16, 694, 175, 71],
  },
  "store-source-tail-right": {
    file: "flows/85a58afb-b3e8-4f69-b274-69762b09ffbf/005.webp",
    rect: [202, 694, 175, 71],
  },
  "store-source-reported-shea": {
    file: "flows/82159116-18bf-4988-9acd-0f1bb1f76a0f/006.webp",
    rect: [202, 462, 175, 174],
    darkTextOcclusions: [[74, 73, 29, 29]],
    textOcclusionDilation: 0.25,
    photoRadius: 20,
  },
  "store-search-shampoo-tail-left": {
    file: "flows/1df75dd0-05f6-445c-9709-0e0bda2df3af/004.webp",
    rect: [16, 694, 175, 71],
  },
  "store-search-shampoo-tail-right": {
    file: "flows/1df75dd0-05f6-445c-9709-0e0bda2df3af/004.webp",
    rect: [201, 694, 175, 71],
  },
  // Photograph interiors only. The source heart is removed and the existing
  // clean product photograph supplies the hidden pixels behind the live control.
  "store-search-rice-shampoo-photo": {
    file: "flows/1df75dd0-05f6-445c-9709-0e0bda2df3af/004.webp",
    rect: [17, 196, 173.5, 173.5],
    photoRadius: 19,
    circularOcclusions: [[145, 146, 18]],
    underlayKey: "rice-shampoo",
  },
  "store-search-rosemary-liquid-photo": {
    file: "flows/1df75dd0-05f6-445c-9709-0e0bda2df3af/004.webp",
    rect: [202, 196, 173.5, 173.5],
    photoRadius: 19,
    circularOcclusions: [[145, 146, 18]],
    underlayKey: "rosemary-liquid",
  },
  "store-search-rice-liquid-photo": {
    file: "flows/1df75dd0-05f6-445c-9709-0e0bda2df3af/004.webp",
    rect: [17, 446, 173.5, 173.5],
    photoRadius: 19,
    circularOcclusions: [[145, 146, 18]],
    underlayKey: "rice-liquid",
  },
  "store-search-detox-shampoo-photo": {
    file: "flows/1df75dd0-05f6-445c-9709-0e0bda2df3af/004.webp",
    rect: [202, 446, 173.5, 173.5],
    photoRadius: 19,
    circularOcclusions: [[145, 146, 18]],
    underlayKey: "detox-shampoo",
  },
};
// Verified clean originals are an explicit local allowlist, never remote requests.
const originals: Record<string, string> = {
  "idea-rice-wash": "idea-rice-wash-original.jpg",
  "rice-shampoo": "rice-shampoo-original.jpg",
  "detox-shampoo": "detox-shampoo-original.jpg",
  "rosemary-liquid": "rosemary-liquid-original.jpg",
  "idea-rosemary-liquid": "idea-rosemary-liquid-original.jpg",
  "idea-jojoba": "idea-jojoba-original.jpg",
  "idea-rosemary-bar": "idea-rosemary-bar-original.jpg",
  "rosemary-bar": "idea-rosemary-bar-original.jpg",
  "idea-purple-bundle": "idea-purple-bundle-original.jpg",
  "idea-rosemary-bundle": "idea-rosemary-bundle-original.jpg",
  "rice-liquid": "rice-liquid-original.jpg",
  "argan-liquid-combo": "argan-liquid-combo-original.jpg",
  "home-drmtlgy-retinol": "home-drmtlgy-retinol.jpg",
  "home-drmtlgy-needleless": "home-drmtlgy-needleless.jpg",
  "home-curl-cream": "home-curl-cream.jpg",
  "home-air-dry-cream": "home-air-dry-cream.jpg",
  "shea-gallery-hand": "shea-gallery-hand.jpg",
  "shea-gallery-shower": "shea-gallery-shower.jpg",
  "beauty-starface-product": "beauty-starface.png",
  "beauty-juvia-partial": "beauty-juvia.jpg",
  "beauty-fenty-partial": "beauty-fenty.jpg",
  "beauty-necessaire-product": "beauty-necessaire.jpg",
  "beauty-crown-product": "beauty-crown.jpg",
  "beauty-athena-product": "beauty-athena.png",
  "shea-gallery-hero": "shea-gallery-hero-original.jpg",
  "shea-gallery-testimonial": "shea-gallery-testimonial-original.jpg",
  "shea-gallery-benefits": "shea-gallery-benefits-original.jpg",
  "sugar-body-scrub": "sugar-body-scrub.jpg",
  "charcoal-body-wash": "charcoal-body-wash.jpg",
  "assistant-armor-cap": "mob-armor-angle.jpg",
  "mini-homescape-icon": "homescape-original.png",
  "collection-coastal": "coastal-model-3.jpg",
  "black-conditioner-bag": "black-conditioner-bag.jpeg",
  "chocolate-body-bag": "chocolate-body-bag.jpeg",
  "shower-caddy": "shower-caddy.jpeg",
  "solid-shave-butter": "solid-shave-butter.jpeg",

  "beachy-gelato": "gelato-original.jpeg",
  "buffy-breeze": "buffy-original.webp",
  "carbon-crew": "carbon-original.jpeg",
  "jordan-legend": "jordan-original.jpeg",
  "gift-buds": "skullcandy-original.png",
  "gift-nirvana": "nirvana-original.jpeg",
  "rice-bundle": "rice-bundle.jpeg",
  "whip-mousse": "whip-original.jpeg",
  "hanacure-cleanser": "hanacure-original.png",
  cleo: "cleo.jpeg",
  "round-sunglasses": "round-sunglasses.jpeg",
  "u-see-me": "u-see-me.jpeg",
  "rice-conditioner": "rice-conditioner.jpeg",
  "shampoo-bag": "shampoo-bag.jpeg",
  "carpenter-jeans": "carpenter-jeans.jpeg",
  "heritage-jeans": "heritage-jeans.jpeg",
  "store-hero": "store-hero.png",
  "onboarding-order-parcel": "onboarding-order-parcel.png",
  "onboarding-transit-plane": "onboarding-transit-plane.png",
  "onboarding-delivery-vehicle": "onboarding-delivery-vehicle.png",
  // Clean stills from the already acquired merchant video: 7.5s and 2.9s.
  // These contain photography only; the storefront owns every logo and control.
  "store-kitsch-default-hero": "store-kitsch-brushes-clean.png",
  "store-kitsch-followed-hero": "store-kitsch-woman-clean.png",
  "order-hero": "order-hero.png",
};
const pending = new Map<string, Promise<Buffer>>();
export function readReferenceMedia(key: string): Promise<Buffer> | undefined {
  if (!Object.hasOwn(media, key) && !Object.hasOwn(originals, key))
    return undefined;
  if (!pending.has(key)) {
    const entry = media[key];
    const job = (async () => {
      if (Object.hasOwn(originals, key)) {
        const input = await readFile(
          resolve(
            process.cwd(),
            "../../reference-assets/shop/products",
            originals[key],
          ),
        );
        const picture = sharp(input);
        return (
          key === "store-hero" ||
          key === "store-kitsch-default-hero" ||
          key === "store-kitsch-followed-hero" ||
          key === "order-hero" ||
          key === "collection-coastal"
            ? picture
            : picture.resize(1080, 1080, { fit: "cover", position: "centre" })
        )
          .webp({ quality: 95 })
          .toBuffer();
      }
      const input = await readFile(
        resolve(process.cwd(), "../../references/shop", entry.file),
      );
      const metadata = await sharp(input).metadata();
      if (!metadata.width) throw new Error("Reference image has no dimensions");
      const scale = metadata.width / 393;
      const [left, top, width, height] = entry.rect.map((value) =>
        Math.round(value * scale),
      );
      let crop = sharp(input).extract({ left, top, width, height });
      if (entry.rotateDegrees) {
        crop = crop.ensureAlpha().rotate(entry.rotateDegrees, {
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        });
      }
      if (entry.postRotateRect) {
        const [postLeft, postTop, postWidth, postHeight] =
          entry.postRotateRect.map((value) => Math.round(value * scale));
        crop = crop.extract({
          left: postLeft,
          top: postTop,
          width: postWidth,
          height: postHeight,
        });
      }
      if (
        entry.occlusions?.length ||
        entry.lightTextOcclusions?.length ||
        entry.darkTextOcclusions?.length ||
        entry.pinkChromaKey ||
        entry.circularOcclusions?.length ||
        entry.roundedOcclusions?.length ||
        entry.transparentRoundedOcclusions?.length ||
        entry.photoRadius ||
        entry.lightWordmark
      ) {
        let cleanPhoto = await crop.ensureAlpha().png().toBuffer();
        if (entry.lightWordmark) {
          const pixels = await sharp(cleanPhoto)
            .raw()
            .toBuffer({ resolveWithObject: true });
          for (let offset = 0; offset < pixels.data.length; offset += 4) {
            const low = Math.min(...pixels.data.subarray(offset, offset + 3));
            const high = Math.max(...pixels.data.subarray(offset, offset + 3));
            pixels.data[offset + 3] =
              high - low > 28
                ? 0
                : Math.round(255 * Math.max(0, Math.min(1, (low - 160) / 70)));
            pixels.data.fill(255, offset, offset + 3);
          }
          cleanPhoto = await sharp(pixels.data, { raw: pixels.info })
            .png()
            .toBuffer();
        }
        if (entry.pinkChromaKey) {
          const pixels = await sharp(cleanPhoto)
            .raw()
            .toBuffer({ resolveWithObject: true });
          for (let offset = 0; offset < pixels.data.length; offset += 4) {
            const red = pixels.data[offset],
              green = pixels.data[offset + 1],
              blue = pixels.data[offset + 2],
              value = Math.max(red, green, blue),
              pinkness = Math.min(red - green, blue - green);
            if (
              value < 180 ||
              red < blue - 12 ||
              blue <= green ||
              pinkness <= 2
            )
              continue;
            pixels.data[offset + 3] =
              pinkness >= 7 ? 0 : Math.round((255 * (7 - pinkness)) / 5);
          }
          cleanPhoto = await sharp(pixels.data, { raw: pixels.info })
            .png()
            .toBuffer();
        }
        if (
          entry.lightTextOcclusions?.length ||
          entry.darkTextOcclusions?.length
        ) {
          const pixels = await sharp(cleanPhoto)
            .raw()
            .toBuffer({ resolveWithObject: true });
          // At source scale, a small bounded dilation also removes the captured
          // glyph's dark antialiasing/shadow. Transparent mode changes only alpha;
          // opt-in inpainting interpolates nearby colors within the caption bounds.
          const inkRadius = Math.max(
            0,
            Math.ceil((entry.textOcclusionDilation ?? 1.5) * scale),
          );
          for (const { bounds, dark } of [
            ...(entry.lightTextOcclusions ?? []).map((bounds) => ({
              bounds,
              dark: false,
            })),
            ...(entry.darkTextOcclusions ?? []).map((bounds) => ({
              bounds,
              dark: true,
            })),
          ]) {
            const [x, y, w, h] = bounds.map((value) =>
              Math.round(value * scale),
            );
            const left = Math.max(0, x),
              top = Math.max(0, y);
            const right = Math.min(x + w, width),
              bottom = Math.min(y + h, height);
            const maskWidth = right - left,
              maskHeight = bottom - top;
            if (maskWidth <= 0 || maskHeight <= 0) continue;
            const captionInk = new Uint8Array(maskWidth * maskHeight);
            for (let row = 0; row < maskHeight; row += 1) {
              for (let column = 0; column < maskWidth; column += 1) {
                const offset = ((top + row) * width + left + column) * 4;
                const low = Math.min(
                  pixels.data[offset],
                  pixels.data[offset + 1],
                  pixels.data[offset + 2],
                );
                const high = Math.max(
                  pixels.data[offset],
                  pixels.data[offset + 1],
                  pixels.data[offset + 2],
                );
                const isInk = dark
                  ? high < (entry.darkTextThreshold ?? 96) && high - low <= 32
                  : low >= 175 && high - low <= 28;
                if (!isInk) continue;
                for (let delta = -inkRadius; delta <= inkRadius; delta += 1) {
                  const maskRow = row + delta;
                  if (maskRow < 0 || maskRow >= maskHeight) continue;
                  const reach = Math.floor(
                    Math.sqrt(inkRadius ** 2 - delta ** 2),
                  );
                  captionInk.fill(
                    1,
                    maskRow * maskWidth + Math.max(0, column - reach),
                    maskRow * maskWidth +
                      Math.min(maskWidth, column + reach + 1),
                  );
                }
              }
            }
            if (entry.textOcclusionMode !== "inpaint") {
              for (let row = 0; row < maskHeight; row += 1) {
                for (let column = 0; column < maskWidth; column += 1) {
                  if (!captionInk[row * maskWidth + column]) continue;
                  const offset = ((top + row) * width + left + column) * 4;
                  pixels.data[offset + 3] = 0;
                }
              }
              continue;
            }

            const regionSize = maskWidth * maskHeight;
            let currentRed = new Float32Array(regionSize),
              currentGreen = new Float32Array(regionSize),
              currentBlue = new Float32Array(regionSize);
            let fallbackRed = 0,
              fallbackGreen = 0,
              fallbackBlue = 0,
              fallbackSamples = 0;
            for (let row = 0; row < maskHeight; row += 1) {
              for (let column = 0; column < maskWidth; column += 1) {
                const local = row * maskWidth + column;
                const offset = ((top + row) * width + left + column) * 4;
                currentRed[local] = pixels.data[offset];
                currentGreen[local] = pixels.data[offset + 1];
                currentBlue[local] = pixels.data[offset + 2];
                if (!captionInk[local] && pixels.data[offset + 3] > 0) {
                  fallbackRed += pixels.data[offset];
                  fallbackGreen += pixels.data[offset + 1];
                  fallbackBlue += pixels.data[offset + 2];
                  fallbackSamples += 1;
                }
              }
            }
            const fallback = [
              fallbackSamples ? fallbackRed / fallbackSamples : 127,
              fallbackSamples ? fallbackGreen / fallbackSamples : 127,
              fallbackSamples ? fallbackBlue / fallbackSamples : 127,
            ];
            const searchLimit = Math.max(4, Math.ceil(10 * scale));
            for (let row = 0; row < maskHeight; row += 1) {
              for (let column = 0; column < maskWidth; column += 1) {
                const local = row * maskWidth + column;
                if (!captionInk[local]) continue;
                let red = 0,
                  green = 0,
                  blue = 0,
                  samples = 0;
                for (let radius = 1; radius <= searchLimit; radius += 1) {
                  for (let deltaY = -radius; deltaY <= radius; deltaY += 1) {
                    for (let deltaX = -radius; deltaX <= radius; deltaX += 1) {
                      if (
                        Math.max(Math.abs(deltaX), Math.abs(deltaY)) !== radius
                      )
                        continue;
                      const sampleRow = row + deltaY,
                        sampleColumn = column + deltaX;
                      if (
                        sampleRow < 0 ||
                        sampleRow >= maskHeight ||
                        sampleColumn < 0 ||
                        sampleColumn >= maskWidth
                      )
                        continue;
                      const sample = sampleRow * maskWidth + sampleColumn;
                      if (captionInk[sample]) continue;
                      red += currentRed[sample];
                      green += currentGreen[sample];
                      blue += currentBlue[sample];
                      samples += 1;
                    }
                  }
                  if (samples >= 6) break;
                }
                currentRed[local] = samples ? red / samples : fallback[0];
                currentGreen[local] = samples ? green / samples : fallback[1];
                currentBlue[local] = samples ? blue / samples : fallback[2];
              }
            }

            let nextRed = new Float32Array(currentRed),
              nextGreen = new Float32Array(currentGreen),
              nextBlue = new Float32Array(currentBlue);
            const passes = Math.max(
              20,
              Math.min(72, Math.ceil(Math.max(maskWidth, maskHeight) * 0.7)),
            );
            for (let pass = 0; pass < passes; pass += 1) {
              for (let row = 0; row < maskHeight; row += 1) {
                for (let column = 0; column < maskWidth; column += 1) {
                  const local = row * maskWidth + column;
                  if (!captionInk[local]) continue;
                  let red = 0,
                    green = 0,
                    blue = 0,
                    samples = 0;
                  for (let deltaY = -1; deltaY <= 1; deltaY += 1) {
                    for (let deltaX = -1; deltaX <= 1; deltaX += 1) {
                      if (deltaX === 0 && deltaY === 0) continue;
                      const sampleRow = row + deltaY,
                        sampleColumn = column + deltaX;
                      if (
                        sampleRow < 0 ||
                        sampleRow >= maskHeight ||
                        sampleColumn < 0 ||
                        sampleColumn >= maskWidth
                      )
                        continue;
                      const sample = sampleRow * maskWidth + sampleColumn;
                      red += currentRed[sample];
                      green += currentGreen[sample];
                      blue += currentBlue[sample];
                      samples += 1;
                    }
                  }
                  if (!samples) continue;
                  nextRed[local] = red / samples;
                  nextGreen[local] = green / samples;
                  nextBlue[local] = blue / samples;
                }
              }
              [currentRed, nextRed] = [nextRed, currentRed];
              [currentGreen, nextGreen] = [nextGreen, currentGreen];
              [currentBlue, nextBlue] = [nextBlue, currentBlue];
            }
            for (let row = 0; row < maskHeight; row += 1) {
              for (let column = 0; column < maskWidth; column += 1) {
                const local = row * maskWidth + column;
                if (!captionInk[local]) continue;
                const offset = ((top + row) * width + left + column) * 4;
                pixels.data[offset] = Math.round(currentRed[local]);
                pixels.data[offset + 1] = Math.round(currentGreen[local]);
                pixels.data[offset + 2] = Math.round(currentBlue[local]);
                pixels.data[offset + 3] = 255;
              }
            }
          }
          cleanPhoto = await sharp(pixels.data, { raw: pixels.info })
            .png()
            .toBuffer();
        }
        const cutouts = await Promise.all(
          (entry.occlusions ?? []).map(async ([x, y, w, h]) => ({
            left: Math.round(x * scale),
            top: Math.round(y * scale),
            input: await sharp({
              create: {
                width: Math.round(w * scale),
                height: Math.round(h * scale),
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 1 },
              },
            })
              .png()
              .toBuffer(),
            blend: "dest-out" as const,
          })),
        );
        const photoCutouts: OverlayOptions[] = [...cutouts];
        if (entry.transparentRoundedOcclusions?.length) {
          photoCutouts.push({
            input: Buffer.from(
              `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${entry.transparentRoundedOcclusions.map(([x, y, w, h, radius]) => `<rect x="${x * scale}" y="${y * scale}" width="${w * scale}" height="${h * scale}" rx="${radius * scale}" fill="white"/>`).join("")}</svg>`,
            ),
            blend: "dest-out",
          });
        }
        if (entry.circularOcclusions?.length) {
          photoCutouts.push({
            input: Buffer.from(
              `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${entry.circularOcclusions.map(([x, y, radius]) => `<circle cx="${x * scale}" cy="${y * scale}" r="${radius * scale}" fill="white"/>`).join("")}</svg>`,
            ),
            blend: "dest-out",
          });
        }
        if (entry.roundedOcclusions?.length) {
          const roundedMask = Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${entry.roundedOcclusions.map(([x, y, w, h, radius]) => `<rect x="${x * scale}" y="${y * scale}" width="${w * scale}" height="${h * scale}" rx="${radius * scale}" fill="white"/>`).join("")}</svg>`,
          );
          if (entry.roundedOcclusionFill) {
            const vertical = entry.roundedOcclusionFill === "vertical-gradient";
            const pixels = await sharp(cleanPhoto)
              .raw()
              .toBuffer({ resolveWithObject: true });
            const mask = await sharp(roundedMask)
              .ensureAlpha()
              .raw()
              .toBuffer();
            for (const [x, y, w, h] of entry.roundedOcclusions) {
              const left = Math.max(0, Math.floor(x * scale));
              const right = Math.min(width - 1, Math.ceil((x + w) * scale));
              const top = Math.max(0, Math.floor(y * scale));
              const bottom = Math.min(height, Math.ceil((y + h) * scale));
              const sampleLeft = Math.max(0, left - Math.ceil(scale));
              const sampleRight = Math.min(width - 1, right + Math.ceil(scale));
              const sampleTop = Math.max(0, top - Math.ceil(scale));
              const sampleBottom = Math.min(
                height - 1,
                bottom + Math.ceil(scale),
              );
              for (let row = top; row < bottom; row += 1) {
                for (let column = left; column <= right; column += 1) {
                  const offset = (row * width + column) * 4;
                  const amount = mask[offset + 3] / 255;
                  if (!amount) continue;
                  const position = vertical
                    ? (row - sampleTop) / (sampleBottom - sampleTop || 1)
                    : (column - sampleLeft) / (sampleRight - sampleLeft || 1);
                  const beforeOffset = vertical
                    ? (sampleTop * width + column) * 4
                    : (row * width + sampleLeft) * 4;
                  const afterOffset = vertical
                    ? (sampleBottom * width + column) * 4
                    : (row * width + sampleRight) * 4;
                  for (let channel = 0; channel < 3; channel += 1) {
                    const before = pixels.data[beforeOffset + channel];
                    const after = pixels.data[afterOffset + channel];
                    const background = before + (after - before) * position;
                    pixels.data[offset + channel] = Math.round(
                      pixels.data[offset + channel] * (1 - amount) +
                        background * amount,
                    );
                  }
                  pixels.data[offset + 3] = 255;
                }
              }
            }
            cleanPhoto = await sharp(pixels.data, { raw: pixels.info })
              .png()
              .toBuffer();
          } else {
            photoCutouts.push({ input: roundedMask, blend: "dest-out" });
          }
        }
        if (entry.photoRadius) {
          const radius = entry.photoRadius * scale;
          const maskHeight = height + (entry.photoTopCornersOnly ? radius : 0);
          photoCutouts.push({
            input: Buffer.from(
              `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${maskHeight}" rx="${radius}" fill="white"/></svg>`,
            ),
            blend: "dest-in",
          });
        }
        const foreground = await sharp(cleanPhoto)
          .composite(photoCutouts)
          .png()
          .toBuffer();
        if (entry.underlayKey) {
          const underlayEntry = media[entry.underlayKey];
          if (
            !underlayEntry ||
            underlayEntry.underlayKey ||
            entry.underlayKey === key
          )
            throw new Error(
              "Reference photo underlays must be single-level crops",
            );
          const underlay = await readReferenceMedia(entry.underlayKey);
          if (!underlay)
            throw new Error("Reference photo underlay is unavailable");
          const background = await sharp(underlay)
            .resize(width, height, { fit: "fill" })
            .png()
            .toBuffer();
          return sharp(background)
            .composite([{ input: foreground }])
            .webp({ lossless: true, effort: 4 })
            .toBuffer();
        }
        return sharp(foreground).webp({ lossless: true, effort: 4 }).toBuffer();
      }
      return crop.webp({ lossless: true, effort: 4 }).toBuffer();
    })();
    pending.set(key, job);
    void job.catch(() => pending.delete(key));
  }
  return pending.get(key);
}
