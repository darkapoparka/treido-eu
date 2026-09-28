// Captured Mini identities shared by discovery and recently viewed surfaces.
export const miniCatalog = {
  pair: {
    name: "Pair It With",
    description:
      "Snap or upload a photo of any item and discover AI-powered product recommendations that perfectly complement your style.",
    available: false,
  },
  recipe: {
    name: "Recipe Lens",
    description: "Turn any Dish Photos to get Ingredients & Recipe",
    available: false,
  },
  steal: {
    name: "Steal The Look",
    description:
      "Upload any outfit and instantly find matching items from Shop",
    available: false,
  },
  rumi: {
    name: "Rumi Interior Design",
    description: "Design your dream room with Rumi",
    available: false,
  },
  space: {
    name: "Design Your Space",
    description: "Visualize art and décor in your space!",
    available: false,
  },
  nest: {
    name: "NestIn: AI Interior Design",
    description:
      "Visualize products in your room and get personalized AI design recommendations.",
    available: false,
  },
  glow: {
    name: "Glow Coach",
    description:
      "AI-powered personalized makeup looks with step-by-step tutorials",
    available: false,
  },
  makeupify: {
    name: "Makeupify",
    description:
      "Virtual makeup try-on app. Take a selfie, choose from 8 makeup styles with 2 intensity levels, and get personalized product recommendations.",
    available: false,
  },
  selfe: {
    name: "Selfe.",
    description: "Take a selfie. Get personalized self-care insights.",
    available: false,
  },
  fridays: {
    name: "Summer Fridays Skincare Routine Finder",
    description:
      "Find the perfect morning and nighttime skincare routine for your skin type",
    available: false,
  },
  makeup: {
    name: "Makeup Master",
    description: 'Unlock your glow with "Makeup Master"',
    available: true,
  },
  picnic: {
    name: "Picnic Gift Registry",
    description:
      "Turn collections into gift registries & share them with friends",
    available: true,
  },
  sol: {
    name: "Sol: Browse by Voice",
    description: "Your AI shopping companion you can talk to.",
    available: true,
  },
  skin: {
    name: "Skincare AI",
    description: "Analyze your skin instantly with advanced AI. Detect vi…",
    available: true,
  },
  look: {
    name: "Get the Look",
    description: "Find every piece from any outfit",
    available: true,
  },
  gift: {
    name: "Gift Sense",
    description: "A new way to find the perfect gift",
    available: true,
  },
  room: {
    name: "Get that room",
    description: "Snap your inspiration, and discover items direc…",
    available: false,
  },
  color: {
    name: "Infinite Color Search",
    description: "Shop your favorite color. Powered by Hoppn.",
    available: false,
  },
  decor: {
    name: "Help Me Decor",
    description: "AI-powered interior styling Shop Mini that help…",
    available: false,
  },
  homescape: {
    name: "Homescape AI",
    description: "Home décor ideas with arts, plants & renovation",
    available: false,
  },
} as const;
export type MiniId = keyof typeof miniCatalog;
export const liveExploreMiniIds = ["makeup", "look", "picnic"] as const;
export function miniIcon(id: string, android = false): string {
  const live = [
    "makeup",
    "picnic",
    "room",
    "color",
    "pair",
    "recipe",
    "steal",
    "homescape",
    "rumi",
    "space",
    "nest",
    "glow",
    "makeupify",
    "selfe",
    "skin",
    "fridays",
  ];
  const native =
    id === "makeup" || id === "picnic" || (android && live.includes(id));
  return `/api/reference-media/${native ? "live-mini" : "mini"}-${id}-icon`;
}
export const featuredMiniIds = ["sol", "skin", "look", "gift"] as const;
export function findMini(id: string) {
  return Object.hasOwn(miniCatalog, id) ? miniCatalog[id as MiniId] : undefined;
}
export function miniHref(id: string): string {
  return findMini(id)?.available
    ? `/minis/${id}`
    : `/minis?notice=${encodeURIComponent(id)}`;
}

// Current Android catalog order, captured on emulator-5560. Frozen order stays above.
export const liveFeaturedMiniIds = [
  "makeup",
  "look",
  "picnic",
  "gift",
] as const;
export const liveMiniGroups = [
  {
    title: "Snap & Shop",
    pages: [
      ["room", "color", "pair"],
      ["recipe", "look", "steal"],
    ],
  },
  {
    title: "Design Your Space",
    pages: [["homescape", "rumi", "space"], ["nest"]],
  },
  {
    title: "Beauty Solutions",
    pages: [
      ["glow", "makeupify", "makeup"],
      ["selfe", "skin", "fridays"],
    ],
  },
] as const;
export function miniPresentation(id: string, android = false) {
  const mini = findMini(id);
  if (!mini || !android) return mini;
  const descriptions: Record<string, string> = {
    room: "Snap your inspiration, and discover items directly in Shop",
    homescape: "Home décor ideas with arts, plants, & renovation",
    skin: "Analyze your skin instantly with advanced AI. Detect visible issues like acne or dryness and get targeted product recommendations designed to solve your specific skin concerns.",
  };
  return { ...mini, description: descriptions[id] ?? mini.description };
}

export type NativeMiniInformation = Readonly<{
  description: string;
  developer: string;
  shareUrl: string;
  termsUrl?: string;
  privacyUrl?: string;
}>;
export const liveMiniInformation: Readonly<
  Partial<Record<MiniId, NativeMiniInformation>>
> = {
  look: {
    description: "Find every piece from any outfit",
    developer: "Lit Dog Labs",
    shareUrl: "https://shop.app/mini/shop-the-look-c7om",
    termsUrl: "https://get-the-look.lit.dog/terms",
    privacyUrl: "https://get-the-look.lit.dog/privacy",
  },
  makeup: {
    description: 'Unlock your glow with "Makeup Master"',
    developer: "LI Solutions OÜ",
    shareUrl: "https://shop.app/mini/makeup-master",
  },
  picnic: {
    description:
      "Turn collections into gift registries & share them with friends",
    developer: "Sundae Lane",
    shareUrl: "https://shop.app/mini/gift-registry-app",
  },
};
