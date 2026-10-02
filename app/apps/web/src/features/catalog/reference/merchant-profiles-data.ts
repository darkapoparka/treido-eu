import type { MerchantPresentation } from "../merchant-types";
// Public brand identity and artwork, inspected on emulator-5560, 2026-09-29.
export const capturedMerchantProfiles: Readonly<
  Record<string, MerchantPresentation>
> = {
  cozyearth: {
    source: "captured",
    background: "#5d493e",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description:
      "Cozy Earth's bamboo bedding and loungewear is superbly soft and temperature regulating. We go above and beyond in providing the most high-quality products that have received thousands of 5-star reviews. Discover why, with Cozy Earth.",
    categories: [],
    avatar: "/api/reference-media/merchant-system-cozy-earth-avatar",
    descriptionExpandable: true,
    reviewPhotos: [
      "/api/reference-media/merchant-system-cozy-earth-review-photo-0",
      "/api/reference-media/merchant-system-cozy-earth-review-photo-1",
      "/api/reference-media/merchant-system-cozy-earth-review-photo-2",
      "/api/reference-media/merchant-system-cozy-earth-review-photo-3",
    ],
  },
  naadam: {
    source: "captured",
    background: "#99857b",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description:
      "NAADAM responsibly sources & produces luxury knitwear while preserving nomadic lifestyle in Mongolia. Shop cashmere clothing for men, women & children.",
    categories: [
      {
        slug: "women-s-all",
        title: "Women's All",
        image: "/api/reference-media/merchant-system-naadam-category-0",
      },
      {
        slug: "men-s-all",
        title: "Men's All",
        image: "/api/reference-media/merchant-system-naadam-category-1",
      },
      {
        slug: "the-original-sweater",
        title: "The Original Sweater",
        image: "/api/reference-media/merchant-system-naadam-category-2",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-naadam-category-3",
      },
    ],
    avatar: "/api/reference-media/merchant-system-naadam-avatar",
    descriptionExpandable: false,
    reviewPhotos: [],
  },
  fentybeauty: {
    source: "captured",
    background: "#91555f",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description:
      "Fenty Beauty by Rihanna was created with promise of inclusion for all women. With an unmatched offering of shades and colors for ALL skin tones, you'll never look elsewhere for your beauty staples. Browse our foundation line, lip colors, and so much more. ",
    categories: [
      {
        slug: "bestsellers",
        title: "Bestsellers",
        image: "/api/reference-media/merchant-system-fenty-beauty-category-0",
      },
      {
        slug: "skincare",
        title: "Skincare",
        image: "/api/reference-media/merchant-system-fenty-beauty-category-1",
      },
      {
        slug: "makeup",
        title: "Makeup",
        image: "/api/reference-media/merchant-system-fenty-beauty-category-2",
      },
      {
        slug: "rihanna-s-faves",
        title: "Rihanna's Faves",
        image: "/api/reference-media/merchant-system-fenty-beauty-category-3",
      },
      {
        slug: "body",
        title: "Body",
        image: "/api/reference-media/merchant-system-fenty-beauty-category-4",
      },
      {
        slug: "fragrance",
        title: "Fragrance",
        image: "/api/reference-media/merchant-system-fenty-beauty-category-5",
      },
      {
        slug: "sets",
        title: "Sets",
        image: "/api/reference-media/merchant-system-fenty-beauty-category-6",
      },
      {
        slug: "lip",
        title: "Lip",
        image: "/api/reference-media/merchant-system-fenty-beauty-category-7",
      },
      {
        slug: "hair",
        title: "Hair",
        image: "/api/reference-media/merchant-system-fenty-beauty-category-8",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-fenty-beauty-category-9",
      },
    ],
    avatar: "/api/reference-media/merchant-system-fenty-beauty-avatar",
    descriptionExpandable: true,
    reviewPhotos: [],
  },
  saie: {
    source: "captured",
    background: "#484c5e",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description:
      "Welcome to our world, where high-performance formulas, sustainable packaging and practices, and inspired design are just as important as clean, good-for-you ingredients. We create products that are formulated by experts, backed by industry secrets and made for beauty fans everywhere.",
    categories: [
      {
        slug: "face",
        title: "Face",
        image: "/api/reference-media/merchant-system-saie-category-0",
      },
      {
        slug: "product-type",
        title: "Product Type",
        image: "/api/reference-media/merchant-system-saie-category-1",
      },
      {
        slug: "eye",
        title: "Eye",
        image: "/api/reference-media/merchant-system-saie-category-2",
      },
      {
        slug: "lip",
        title: "Lip",
        image: "/api/reference-media/merchant-system-saie-category-3",
      },
      {
        slug: "merch",
        title: "Merch",
        image: "/api/reference-media/merchant-system-saie-category-4",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-saie-category-5",
      },
    ],
    avatar: "/api/reference-media/merchant-system-saie-avatar",
    descriptionExpandable: true,
    reviewPhotos: [],
  },
  beautyofjoseon: {
    source: "captured",
    background: "#c397a1",
    foreground: "#111111",
    panel: "#ffffff40",
    description:
      "Explore Beauty of Joseon, a Korean skincare brand 100% dedicated to creating clean & effective skincare products using traditional Korean Hanbang ingredients.",
    categories: [
      {
        slug: "ginseng",
        title: "Ginseng",
        image:
          "/api/reference-media/merchant-system-beauty-of-joseon-category-0",
      },
      {
        slug: "rice-bran",
        title: "Rice Bran",
        image:
          "/api/reference-media/merchant-system-beauty-of-joseon-category-1",
      },
      {
        slug: "bundles-sets",
        title: "Bundles & Sets",
        image:
          "/api/reference-media/merchant-system-beauty-of-joseon-category-2",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image:
          "/api/reference-media/merchant-system-beauty-of-joseon-category-3",
      },
    ],
    avatar: "/api/reference-media/merchant-system-beauty-of-joseon-avatar",
    descriptionExpandable: false,
    reviewPhotos: [],
  },
  madeincookware: {
    showRecentlyViewed: true,
    storeControlBackground: "#767178",
    heroHeight: 260,
    coverHeight: 340,
    wordmarkTop: 52,
    wordmark: "/api/reference-media/merchant-madein-wordmark",
    cover: "/api/reference-media/merchant-madein-poster",
    coverVideo: "merchant-madein-hero",
    source: "captured",
    background: "#615d63",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description:
      "Born out of our 100-year old, family-owned restaurant supply business, we started Made In to bring restaurant-quality, performance kitchenware to home cooks around the world. We're excited you're here to cook with us.",
    categories: [
      {
        slug: "cookware",
        title: "Cookware",
        image:
          "/api/reference-media/merchant-system-made-in-cookware-category-0",
      },
      {
        slug: "stainless-clad",
        title: "Stainless Clad",
        image:
          "/api/reference-media/merchant-system-made-in-cookware-category-1",
      },
      {
        slug: "most-popular",
        title: "Most Popular",
        image:
          "/api/reference-media/merchant-system-made-in-cookware-category-2",
      },
      {
        slug: "carbon-steel",
        title: "Carbon Steel",
        image:
          "/api/reference-media/merchant-system-made-in-cookware-category-3",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image:
          "/api/reference-media/merchant-system-made-in-cookware-category-4",
        profileWide: true,
      },
    ],
    avatar: "/api/reference-media/merchant-system-made-in-cookware-avatar",
    descriptionExpandable: true,
    reviewPhotos: [],
  },
  staud: {
    source: "captured",
    background: "#977278",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description:
      "Explore the world of STAUD—modern clothing, iconic handbags, and everyday pieces with a point of view. Sign up for emails and get an exclusive offer on your first order.",
    categories: [
      {
        slug: "dresses",
        title: "Dresses",
        image: "/api/reference-media/merchant-system-staud-category-0",
      },
      {
        slug: "handbags",
        title: "Handbags",
        image: "/api/reference-media/merchant-system-staud-category-1",
      },
      {
        slug: "shoes",
        title: "Shoes",
        image: "/api/reference-media/merchant-system-staud-category-2",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-staud-category-3",
      },
    ],
    avatar: "/api/reference-media/merchant-system-staud-avatar",
    descriptionExpandable: false,
    reviewPhotos: [],
  },
  brooklinen: {
    source: "captured",
    background: "#94908e",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description:
      "Luxury bed sheets, pillows, comforters, & blankets delivered straight to your door. The best way to outfit your bedroom. ",
    categories: [
      {
        slug: "all-bath",
        title: "All Bath",
        image: "/api/reference-media/merchant-system-brooklinen-category-0",
      },
      {
        slug: "new-arrivals",
        title: "New Arrivals",
        image: "/api/reference-media/merchant-system-brooklinen-category-1",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-brooklinen-category-2",
        profileWide: true,
      },
    ],
    avatar: "/api/reference-media/merchant-system-brooklinen-avatar",
    descriptionExpandable: false,
    reviewPhotos: [
      "/api/reference-media/merchant-system-brooklinen-review-photo-0",
      "/api/reference-media/merchant-system-brooklinen-review-photo-1",
      "/api/reference-media/merchant-system-brooklinen-review-photo-2",
      "/api/reference-media/merchant-system-brooklinen-review-photo-3",
      "/api/reference-media/merchant-system-brooklinen-review-photo-4",
    ],
  },
  luluandgeorgia: {
    source: "captured",
    background: "#6e523c",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description:
      "Shop Lulu and Georgia for the best and latest in rugs, furniture, home accents, lighting, and more—including exclusive styles you won't find anywhere else.",
    categories: [
      {
        slug: "new-arrivals",
        title: "New Arrivals",
        image:
          "/api/reference-media/merchant-system-lulu-and-georgia-category-0",
      },
      {
        slug: "rugs",
        title: "Rugs",
        image:
          "/api/reference-media/merchant-system-lulu-and-georgia-category-1",
      },
      {
        slug: "furniture",
        title: "Furniture",
        image:
          "/api/reference-media/merchant-system-lulu-and-georgia-category-2",
      },
      {
        slug: "lighting",
        title: "Lighting",
        image:
          "/api/reference-media/merchant-system-lulu-and-georgia-category-3",
      },
      {
        slug: "pillows-throws",
        title: "Pillows + Throws",
        image:
          "/api/reference-media/merchant-system-lulu-and-georgia-category-4",
      },
      {
        slug: "walls",
        title: "Walls",
        image:
          "/api/reference-media/merchant-system-lulu-and-georgia-category-5",
      },
      {
        slug: "de-cor-tabletop",
        title: "Décor + Tabletop",
        image:
          "/api/reference-media/merchant-system-lulu-and-georgia-category-6",
      },
      {
        slug: "bed-bath",
        title: "Bed + Bath",
        image:
          "/api/reference-media/merchant-system-lulu-and-georgia-category-7",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image:
          "/api/reference-media/merchant-system-lulu-and-georgia-category-8",
        profileWide: true,
      },
    ],
    avatar: "/api/reference-media/merchant-system-lulu-and-georgia-avatar",
    descriptionExpandable: false,
    reviewPhotos: [],
  },
  langehair: {
    source: "captured",
    background: "#915546",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description:
      "I honestly can't say which product I love more cause they are all just amazing. L'ange hair products smell so great, and they make my hair look great.",
    categories: [
      {
        slug: "styling-tools",
        title: "Styling Tools",
        image: "/api/reference-media/merchant-system-l-ange-hair-category-0",
      },
      {
        slug: "accessories",
        title: "Accessories",
        image: "/api/reference-media/merchant-system-l-ange-hair-category-1",
      },
      {
        slug: "new-arrivals",
        title: "New Arrivals",
        image: "/api/reference-media/merchant-system-l-ange-hair-category-2",
      },
      {
        slug: "best-sellers",
        title: "Best Sellers",
        image: "/api/reference-media/merchant-system-l-ange-hair-category-3",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-l-ange-hair-category-4",
        profileWide: true,
      },
    ],
    avatar: "/api/reference-media/merchant-system-l-ange-hair-avatar",
    descriptionExpandable: false,
    reviewPhotos: [],
  },
  hanacure: {
    source: "captured",
    background: "#cbcfda",
    foreground: "#111111",
    panel: "#ffffff40",
    description:
      "Hanacure creates efficient and effective solutions for healthy skin. Experience cross-functional skincare that delivers professional-level results.\n",
    categories: [
      {
        slug: "products",
        title: "Products",
        image: "/api/reference-media/merchant-system-hanacure-category-0",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-hanacure-category-1",
      },
    ],
    avatar: "/api/reference-media/merchant-system-hanacure-avatar",
    descriptionExpandable: false,
    reviewPhotos: [
      "/api/reference-media/merchant-system-hanacure-review-photo-0",
      "/api/reference-media/merchant-system-hanacure-review-photo-1",
      "/api/reference-media/merchant-system-hanacure-review-photo-2",
      "/api/reference-media/merchant-system-hanacure-review-photo-3",
      "/api/reference-media/merchant-system-hanacure-review-photo-4",
      "/api/reference-media/merchant-system-hanacure-review-photo-6",
    ],
  },
  bareminerals: {
    source: "captured",
    background: "#755953",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description:
      "Award-winning mineral makeup and skin care products. We bring together the most effective natural ingredients and the latest advancements in skincare. Enjoy free shipping and samples on orders $50 and over. ",
    categories: [
      {
        slug: "face",
        title: "Face",
        image: "/api/reference-media/merchant-system-bare-minerals-category-0",
      },
      {
        slug: "eye",
        title: "Eye",
        image: "/api/reference-media/merchant-system-bare-minerals-category-1",
      },
      {
        slug: "lip",
        title: "Lip",
        image: "/api/reference-media/merchant-system-bare-minerals-category-2",
      },
      {
        slug: "skincare",
        title: "Skincare",
        image: "/api/reference-media/merchant-system-bare-minerals-category-3",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-bare-minerals-category-4",
        profileWide: true,
      },
    ],
    avatar: "/api/reference-media/merchant-system-bare-minerals-avatar",
    descriptionExpandable: true,
    reviewPhotos: [],
  },
  thecitizenry: {
    source: "captured",
    background: "#817567",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description: "",
    categories: [
      {
        slug: "mirrors-wall-art",
        title: "Mirrors & Wall Art",
        image: "/api/reference-media/merchant-system-the-citizenry-category-0",
      },
      {
        slug: "bedding",
        title: "Bedding",
        image: "/api/reference-media/merchant-system-the-citizenry-category-1",
      },
      {
        slug: "kitchen",
        title: "Kitchen",
        image: "/api/reference-media/merchant-system-the-citizenry-category-2",
      },
      {
        slug: "bath",
        title: "Bath",
        image: "/api/reference-media/merchant-system-the-citizenry-category-3",
      },
      {
        slug: "archive-sale",
        title: "Archive Sale",
        image: "/api/reference-media/merchant-system-the-citizenry-category-4",
      },
      {
        slug: "rugs",
        title: "Rugs",
        image: "/api/reference-media/merchant-system-the-citizenry-category-5",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-the-citizenry-category-6",
        profileWide: true,
      },
    ],
    descriptionExpandable: false,
    reviewPhotos: [],
  },
  trueclassic: {
    source: "captured",
    background: "#5d493f",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description:
      "We produce butter soft, affordable, high quality fitted premium tees for men. Super versatile shirts that can be worn for any occasion including date nights, chilling at home or athletic activities.",
    categories: [
      {
        slug: "best-sellers",
        title: "Best Sellers",
        image: "/api/reference-media/merchant-system-true-classic-category-0",
      },
      {
        slug: "we-made-too-much",
        title: "We Made Too Much!",
        image: "/api/reference-media/merchant-system-true-classic-category-1",
      },
      {
        slug: "underwear-more",
        title: "Underwear & More!",
        image: "/api/reference-media/merchant-system-true-classic-category-2",
      },
      {
        slug: "dress-shirts",
        title: "Dress Shirts",
        image: "/api/reference-media/merchant-system-true-classic-category-3",
      },
      {
        slug: "outerwear",
        title: "Outerwear",
        image: "/api/reference-media/merchant-system-true-classic-category-4",
      },
      {
        slug: "crew-necks",
        title: "Crew Necks",
        image: "/api/reference-media/merchant-system-true-classic-category-5",
      },
      {
        slug: "active",
        title: "Active",
        image: "/api/reference-media/merchant-system-true-classic-category-6",
      },
      {
        slug: "v-neck",
        title: "V-Neck",
        image: "/api/reference-media/merchant-system-true-classic-category-7",
      },
      {
        slug: "polos",
        title: "Polos",
        image: "/api/reference-media/merchant-system-true-classic-category-8",
      },
      {
        slug: "pants-denim",
        title: "Pants & Denim",
        image: "/api/reference-media/merchant-system-true-classic-category-9",
      },
      {
        slug: "packs-bundles",
        title: "Packs & Bundles",
        image: "/api/reference-media/merchant-system-true-classic-category-10",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-true-classic-category-11",
      },
    ],
    avatar: "/api/reference-media/merchant-system-true-classic-avatar",
    descriptionExpandable: true,
    reviewPhotos: [],
  },
  kickscrew: {
    source: "captured",
    background: "#171b15",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description:
      "KICKS CREW is a trusted global platform for sneakers and apparel. Shop our extensive collection, ranging from the latest limited editions to high-performance sportswear.",
    categories: [],
    avatar: "/api/reference-media/merchant-system-kicks-crew-avatar",
    descriptionExpandable: false,
    reviewPhotos: [
      "/api/reference-media/merchant-system-kicks-crew-review-photo-0",
      "/api/reference-media/merchant-system-kicks-crew-review-photo-1",
      "/api/reference-media/merchant-system-kicks-crew-review-photo-2",
      "/api/reference-media/merchant-system-kicks-crew-review-photo-3",
      "/api/reference-media/merchant-system-kicks-crew-review-photo-4",
    ],
  },
  drmtlgy: {
    source: "captured",
    background: "#b09c8a",
    foreground: "#111111",
    panel: "#ffffff40",
    description:
      "We believe that all products should be backed by science. We also believe that you don't have to sacrifice safety for providing skin care products that actually work. We follow two simple rules: 1) It can't be bad for you and 2) It has to work.",
    categories: [
      {
        slug: "serums",
        title: "Serums",
        image: "/api/reference-media/merchant-system-drmtlgy-category-0",
      },
      {
        slug: "best-sellers",
        title: "Best Sellers",
        image: "/api/reference-media/merchant-system-drmtlgy-category-1",
      },
      {
        slug: "cleansers",
        title: "Cleansers",
        image: "/api/reference-media/merchant-system-drmtlgy-category-2",
      },
      {
        slug: "sunscreens",
        title: "Sunscreens",
        image: "/api/reference-media/merchant-system-drmtlgy-category-3",
      },
      {
        slug: "masks",
        title: "Masks",
        image: "/api/reference-media/merchant-system-drmtlgy-category-4",
      },
      {
        slug: "exfoliants",
        title: "Exfoliants",
        image: "/api/reference-media/merchant-system-drmtlgy-category-5",
      },
      {
        slug: "toners",
        title: "Toners",
        image: "/api/reference-media/merchant-system-drmtlgy-category-6",
      },
      {
        slug: "body-care",
        title: "Body Care",
        image: "/api/reference-media/merchant-system-drmtlgy-category-7",
      },
      {
        slug: "moisturizers",
        title: "Moisturizers",
        image: "/api/reference-media/merchant-system-drmtlgy-category-8",
      },
      {
        slug: "bundles-sets",
        title: "Bundles & Sets",
        image: "/api/reference-media/merchant-system-drmtlgy-category-9",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-drmtlgy-category-10",
        profileWide: true,
      },
    ],
    avatar: "/api/reference-media/merchant-system-drmtlgy-avatar",
    descriptionExpandable: true,
    reviewPhotos: [],
  },
  cityjeans: {
    source: "captured",
    background: "#fafafa",
    foreground: "#111111",
    panel: "#ffffff40",
    description:
      "We at City Jeans pride ourselves on being one of the best brand name retailers in footwear and apparel. We carry exclusive items from top companies such as Nike, UGG, Adidas, Timberland, and Jordan. We have 9 stores (and growing) in The Bronx and Queens area.",
    categories: [],
    avatar: "/api/reference-media/merchant-system-city-jeans-avatar",
    descriptionExpandable: true,
    reviewPhotos: [
      "/api/reference-media/merchant-system-city-jeans-review-photo-0",
      "/api/reference-media/merchant-system-city-jeans-review-photo-1",
      "/api/reference-media/merchant-system-city-jeans-review-photo-2",
      "/api/reference-media/merchant-system-city-jeans-review-photo-3",
      "/api/reference-media/merchant-system-city-jeans-review-photo-4",
    ],
  },
  juviasplace: {
    source: "captured",
    background: "#fe4461",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description: "",
    categories: [],
    avatar: "/api/reference-media/merchant-system-juvia-s-place-avatar",
    descriptionExpandable: false,
    reviewPhotos: [
      "/api/reference-media/merchant-system-juvia-s-place-review-photo-0",
      "/api/reference-media/merchant-system-juvia-s-place-review-photo-1",
      "/api/reference-media/merchant-system-juvia-s-place-review-photo-2",
      "/api/reference-media/merchant-system-juvia-s-place-review-photo-3",
      "/api/reference-media/merchant-system-juvia-s-place-review-photo-4",
    ],
  },
  chemicalguys: {
    source: "captured",
    background: "#c2b6c0",
    foreground: "#111111",
    panel: "#ffffff40",
    description:
      "Chemical Guys is a world leader in the car care industry, specializing in the highest quality chemicals, accessories, buffing pads and machines.",
    categories: [
      {
        slug: "kits",
        title: "Kits",
        image: "/api/reference-media/merchant-system-chemical-guys-category-0",
      },
      {
        slug: "exterior",
        title: "Exterior",
        image: "/api/reference-media/merchant-system-chemical-guys-category-1",
      },
      {
        slug: "interior",
        title: "Interior",
        image: "/api/reference-media/merchant-system-chemical-guys-category-2",
      },
      {
        slug: "drying",
        title: "Drying",
        image: "/api/reference-media/merchant-system-chemical-guys-category-3",
      },
      {
        slug: "ceramic",
        title: "Ceramic",
        image: "/api/reference-media/merchant-system-chemical-guys-category-4",
      },
      {
        slug: "more",
        title: "More",
        image: "/api/reference-media/merchant-system-chemical-guys-category-5",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-chemical-guys-category-6",
        profileWide: true,
      },
    ],
    avatar: "/api/reference-media/merchant-system-chemical-guys-avatar",
    descriptionExpandable: false,
    reviewPhotos: [],
  },
  forkeyewear: {
    source: "captured",
    background: "#958177",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description: "",
    categories: [
      {
        slug: "accessories",
        title: "Accessories",
        image: "/api/reference-media/merchant-system-fork-eyewear-category-0",
      },
      {
        slug: "women",
        title: "Women",
        image: "/api/reference-media/merchant-system-fork-eyewear-category-1",
      },
      {
        slug: "men",
        title: "Men",
        image: "/api/reference-media/merchant-system-fork-eyewear-category-2",
      },
      {
        slug: "acetate",
        title: "Acetate",
        image: "/api/reference-media/merchant-system-fork-eyewear-category-3",
      },
      {
        slug: "metal",
        title: "Metal",
        image: "/api/reference-media/merchant-system-fork-eyewear-category-4",
      },
      {
        slug: "all-products",
        title: "All Products",
        image: "/api/reference-media/merchant-system-fork-eyewear-category-5",
      },
      {
        slug: "fresh-drop",
        title: "Fresh Drop",
        image: "/api/reference-media/merchant-system-fork-eyewear-category-6",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-fork-eyewear-category-7",
      },
    ],
    descriptionExpandable: false,
    reviewPhotos: [],
  },
  fitjeans: {
    source: "captured",
    background: "#9f938d",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description: "",
    categories: [
      {
        slug: "flared",
        title: "Flared",
        image: "/api/reference-media/merchant-system-fitjeans-category-0",
      },
      {
        slug: "baggy",
        title: "Baggy",
        image: "/api/reference-media/merchant-system-fitjeans-category-1",
      },
      {
        slug: "contour",
        title: "Contour",
        image: "/api/reference-media/merchant-system-fitjeans-category-2",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-fitjeans-category-3",
      },
    ],
    avatar: "/api/reference-media/merchant-system-fitjeans-avatar",
    descriptionExpandable: false,
    reviewPhotos: [
      "/api/reference-media/merchant-system-fitjeans-review-photo-0",
      "/api/reference-media/merchant-system-fitjeans-review-photo-1",
      "/api/reference-media/merchant-system-fitjeans-review-photo-2",
    ],
  },
  vehla: {
    source: "captured",
    background: "#fafafa",
    foreground: "#111111",
    panel: "#ffffff40",
    description: "",
    categories: [],
    avatar: "/api/reference-media/merchant-system-vehla-avatar",
    descriptionExpandable: false,
    reviewPhotos: [
      "/api/reference-media/merchant-system-vehla-review-photo-0",
      "/api/reference-media/merchant-system-vehla-review-photo-1",
      "/api/reference-media/merchant-system-vehla-review-photo-2",
      "/api/reference-media/merchant-system-vehla-review-photo-3",
      "/api/reference-media/merchant-system-vehla-review-photo-4",
      "/api/reference-media/merchant-system-vehla-review-photo-6",
    ],
  },
  pura: {
    source: "captured",
    background: "#4d4133",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description: "",
    categories: [
      {
        slug: "smart-diffusers",
        title: "Smart Diffusers",
        image: "/api/reference-media/merchant-system-pura-category-0",
      },
      {
        slug: "home-fragrances",
        title: "Home fragrances",
        image: "/api/reference-media/merchant-system-pura-category-1",
      },
      {
        slug: "car-fragrances",
        title: "Car fragrances",
        image: "/api/reference-media/merchant-system-pura-category-2",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-pura-category-3",
      },
    ],
    avatar: "/api/reference-media/merchant-system-pura-avatar",
    descriptionExpandable: false,
    reviewPhotos: [
      "/api/reference-media/merchant-system-pura-review-photo-0",
      "/api/reference-media/merchant-system-pura-review-photo-1",
      "/api/reference-media/merchant-system-pura-review-photo-2",
      "/api/reference-media/merchant-system-pura-review-photo-3",
      "/api/reference-media/merchant-system-pura-review-photo-4",
    ],
  },
  fashionnova: {
    source: "captured",
    background: "#fcfcfc",
    foreground: "#111111",
    panel: "#ffffff40",
    description: "",
    categories: [],
    avatar: "/api/reference-media/merchant-system-fashion-nova-avatar",
    descriptionExpandable: false,
    reviewPhotos: [],
  },
  origin: {
    source: "captured",
    background: "#6d594f",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description:
      "ORIGIN™ USA is a direct-to-consumer producer of top quality, 100% American Made boots and apparel. ",
    categories: [
      {
        slug: "accessories",
        title: "ACCESSORIES",
        image: "/api/reference-media/merchant-system-origin-category-0",
      },
      {
        slug: "tops",
        title: "TOPS",
        image: "/api/reference-media/merchant-system-origin-category-1",
      },
      {
        slug: "bottoms",
        title: "BOTTOMS",
        image: "/api/reference-media/merchant-system-origin-category-2",
      },
      {
        slug: "training",
        title: "TRAINING",
        image: "/api/reference-media/merchant-system-origin-category-3",
      },
      {
        slug: "jeans",
        title: "JEANS",
        image: "/api/reference-media/merchant-system-origin-category-4",
      },
      {
        slug: "jiu-jitsu",
        title: "JIU-JITSU",
        image: "/api/reference-media/merchant-system-origin-category-5",
      },
      {
        slug: "last-chance",
        title: "LAST CHANCE",
        image: "/api/reference-media/merchant-system-origin-category-6",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-origin-category-7",
      },
    ],
    avatar: "/api/reference-media/merchant-system-origin-avatar",
    descriptionExpandable: false,
    reviewPhotos: [],
  },
  rangerstation: {
    source: "captured",
    background: "#fafafa",
    foreground: "#111111",
    panel: "#ffffff40",
    description:
      "BLACK FRIDAY SALE: 25.10% OFF EVERYTHING with code BFCM2025.\n\nScent has the power to elevate everything around us, and our products are designed to help you create (and remember) memories.",
    categories: [],
    avatar: "/api/reference-media/merchant-system-ranger-station-avatar",
    descriptionExpandable: true,
    reviewPhotos: [
      "/api/reference-media/merchant-system-ranger-station-review-photo-0",
      "/api/reference-media/merchant-system-ranger-station-review-photo-1",
      "/api/reference-media/merchant-system-ranger-station-review-photo-2",
      "/api/reference-media/merchant-system-ranger-station-review-photo-3",
      "/api/reference-media/merchant-system-ranger-station-review-photo-4",
    ],
  },
  woojdesign: {
    source: "captured",
    background: "#fcfcfc",
    foreground: "#111111",
    panel: "#ffffff40",
    description:
      "Wooj makes home goods that are built by robots and people in Brooklyn, NY. We believe good design and ethical manufacturing should be accessible to everyone.",
    categories: [],
    avatar: "/api/reference-media/merchant-system-wooj-design-avatar",
    descriptionExpandable: false,
    reviewPhotos: [
      "/api/reference-media/merchant-system-wooj-design-review-photo-0",
      "/api/reference-media/merchant-system-wooj-design-review-photo-1",
      "/api/reference-media/merchant-system-wooj-design-review-photo-2",
      "/api/reference-media/merchant-system-wooj-design-review-photo-3",
      "/api/reference-media/merchant-system-wooj-design-review-photo-4",
      "/api/reference-media/merchant-system-wooj-design-review-photo-6",
    ],
  },
  sundaycitizen: {
    source: "captured",
    background: "#a79b95",
    foreground: "#111111",
    panel: "#ffffff40",
    description:
      "For home, body, and spirit, we create comfort one soft piece at a time. Free shipping and free returns. \n\n",
    categories: [
      {
        slug: "wellness",
        title: "Wellness",
        image: "/api/reference-media/merchant-system-sunday-citizen-category-0",
      },
      {
        slug: "home-decor",
        title: "Home + Decor",
        image: "/api/reference-media/merchant-system-sunday-citizen-category-1",
      },
      {
        slug: "robes-loungewear",
        title: "Robes + Loungewear",
        image: "/api/reference-media/merchant-system-sunday-citizen-category-2",
      },
      {
        slug: "bedding",
        title: "Bedding",
        image: "/api/reference-media/merchant-system-sunday-citizen-category-3",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-sunday-citizen-category-4",
        profileWide: true,
      },
    ],
    avatar: "/api/reference-media/merchant-system-sunday-citizen-avatar",
    descriptionExpandable: false,
    reviewPhotos: [],
  },
  flamingoestate: {
    source: "captured",
    background: "#5f533d",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description:
      "Flamingo Estate is a home for radical pleasure — a place to bathe, eat & bask in nature's most precious ingredients. We are a family of farmers & growers fighting for the natural world with green thumbs & middle fingers.",
    categories: [
      {
        slug: "pantry",
        title: "Pantry",
        image:
          "/api/reference-media/merchant-system-flamingo-estate-category-0",
      },
      {
        slug: "bath-body",
        title: "Bath & Body",
        image:
          "/api/reference-media/merchant-system-flamingo-estate-category-1",
      },
      {
        slug: "gifts-sets",
        title: "Gifts & Sets",
        image:
          "/api/reference-media/merchant-system-flamingo-estate-category-2",
      },
      {
        slug: "soap-shop",
        title: "Soap Shop",
        image:
          "/api/reference-media/merchant-system-flamingo-estate-category-3",
      },
      {
        slug: "candles",
        title: "Candles",
        image:
          "/api/reference-media/merchant-system-flamingo-estate-category-4",
      },
      {
        slug: "glass-hand-soap",
        title: "Glass Hand Soap",
        image:
          "/api/reference-media/merchant-system-flamingo-estate-category-5",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image:
          "/api/reference-media/merchant-system-flamingo-estate-category-6",
        profileWide: true,
      },
    ],
    avatar: "/api/reference-media/merchant-system-flamingo-estate-avatar",
    descriptionExpandable: true,
    reviewPhotos: [],
  },
  bollbranch: {
    source: "captured",
    background: "#716557",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description:
      "At Boll & Branch, we hold ourselves to a higher standard. Our bedding is 100% organic, toxin-free and Fair Trade Certified. It makes a difference you'll feel and offers a better way to live in this world. Experience the best bedding risk-free for a month and enjoy free shipping, every day.",
    categories: [
      {
        slug: "new-arrivals",
        title: "New Arrivals",
        image: "/api/reference-media/merchant-system-boll-branch-category-0",
      },
      {
        slug: "bestsellers",
        title: "Bestsellers",
        image: "/api/reference-media/merchant-system-boll-branch-category-1",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-boll-branch-category-2",
        profileWide: true,
      },
    ],
    avatar: "/api/reference-media/merchant-system-boll-branch-avatar",
    descriptionExpandable: true,
    reviewPhotos: [],
  },
  toast: {
    source: "captured",
    background: "#645f5d",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description:
      "TOAST creates modern, simple clothing for both women and men and functional, thoughtful pieces for the home. Shop the latest collection online.",
    categories: [
      {
        slug: "homeware",
        title: "Homeware",
        image: "/api/reference-media/merchant-system-toast-category-0",
      },
      {
        slug: "women-s-footwear",
        title: "Women's Footwear",
        image: "/api/reference-media/merchant-system-toast-category-1",
      },
      {
        slug: "women-s-clothing",
        title: "Women's Clothing",
        image: "/api/reference-media/merchant-system-toast-category-2",
      },
      {
        slug: "women-s-accessories",
        title: "Women's Accessories",
        image: "/api/reference-media/merchant-system-toast-category-3",
      },
      {
        slug: "men-s-clothing",
        title: "Men's Clothing",
        image: "/api/reference-media/merchant-system-toast-category-4",
      },
      {
        slug: "men-s-accessories",
        title: "Men's Accessories",
        image: "/api/reference-media/merchant-system-toast-category-5",
      },
      {
        slug: "men-s-footwear",
        title: "Men's Footwear",
        image: "/api/reference-media/merchant-system-toast-category-6",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-toast-category-7",
      },
    ],
    avatar: "/api/reference-media/merchant-system-toast-avatar",
    descriptionExpandable: false,
    reviewPhotos: [],
  },
  estellecoloredglass: {
    source: "captured",
    background: "#c5d1c7",
    foreground: "#111111",
    panel: "#ffffff40",
    description: "",
    categories: [
      {
        slug: "spring-arrivals",
        title: "Spring Arrivals",
        image:
          "/api/reference-media/merchant-system-estelle-colored-glass-category-0",
      },
      {
        slug: "new-arrivals",
        title: "New Arrivals",
        image:
          "/api/reference-media/merchant-system-estelle-colored-glass-category-1",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image:
          "/api/reference-media/merchant-system-estelle-colored-glass-category-2",
        profileWide: true,
      },
    ],
    descriptionExpandable: false,
    reviewPhotos: [],
  },
  ekster: {
    source: "captured",
    background: "#837670",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description:
      "We make time-saving carry goods to speed up your day. Our smart wallets and accessories are made from premium, environmentally certified materials, built to save you time. Free Shipping & Free Returns.",
    categories: [
      {
        slug: "all-wallets",
        title: "All Wallets",
        image: "/api/reference-media/merchant-system-ekster-category-0",
      },
      {
        slug: "travel",
        title: "Travel",
        image: "/api/reference-media/merchant-system-ekster-category-1",
      },
      {
        slug: "all-accessories",
        title: "All Accessories",
        image: "/api/reference-media/merchant-system-ekster-category-2",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-ekster-category-3",
      },
    ],
    avatar: "/api/reference-media/merchant-system-ekster-avatar",
    descriptionExpandable: true,
    reviewPhotos: [],
  },
  roughlinen: {
    source: "captured",
    background: "#666258",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description: "",
    categories: [
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-rough-linen-category-0",
        profileWide: true,
      },
    ],
    avatar: "/api/reference-media/merchant-system-rough-linen-avatar",
    descriptionExpandable: false,
    reviewPhotos: [
      "/api/reference-media/merchant-system-rough-linen-review-photo-0",
      "/api/reference-media/merchant-system-rough-linen-review-photo-1",
      "/api/reference-media/merchant-system-rough-linen-review-photo-2",
      "/api/reference-media/merchant-system-rough-linen-review-photo-3",
      "/api/reference-media/merchant-system-rough-linen-review-photo-4",
    ],
  },
  brumate: {
    source: "captured",
    background: "#ddc1b2",
    foreground: "#111111",
    panel: "#ffffff40",
    description:
      "We design products that empower\nand inspire, enhancing your every day.\n#MadeForThis",
    categories: [
      {
        slug: "era-series",
        title: "Era Series",
        image: "/api/reference-media/merchant-system-brumate-category-0",
      },
      {
        slug: "accessories",
        title: "Accessories",
        image: "/api/reference-media/merchant-system-brumate-category-1",
      },
      {
        slug: "rise-series",
        title: "Rise Series",
        image: "/api/reference-media/merchant-system-brumate-category-2",
      },
      {
        slug: "era-flip-series",
        title: "Era Flip Series",
        image: "/api/reference-media/merchant-system-brumate-category-3",
      },
      {
        slug: "mu-v-nav-series",
        title: "Müv + Nav Series",
        image: "/api/reference-media/merchant-system-brumate-category-4",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-brumate-category-5",
      },
    ],
    avatar: "/api/reference-media/merchant-system-brumate-avatar",
    descriptionExpandable: false,
    reviewPhotos: [],
  },
  jonathanadler: {
    source: "captured",
    background: "#6c6866",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description:
      "Jonathan Adler | Modern home decor, accessories and gifts feature chic, iconic designs. Decorate your home with luxurious pottery, pillows, lighting and mid-century modern furniture.",
    categories: [
      {
        slug: "sofas",
        title: "Sofas",
        image: "/api/reference-media/merchant-system-jonathan-adler-category-0",
      },
      {
        slug: "consoles-credenzas",
        title: "Consoles & Credenzas",
        image: "/api/reference-media/merchant-system-jonathan-adler-category-1",
      },
      {
        slug: "bars-bar-carts",
        title: "Bars & Bar Carts",
        image: "/api/reference-media/merchant-system-jonathan-adler-category-2",
      },
      {
        slug: "decorative-objets",
        title: "Decorative Objets",
        image: "/api/reference-media/merchant-system-jonathan-adler-category-3",
      },
      {
        slug: "decor-bowls",
        title: "Decor > Bowls",
        image: "/api/reference-media/merchant-system-jonathan-adler-category-4",
      },
      {
        slug: "games",
        title: "Games",
        image: "/api/reference-media/merchant-system-jonathan-adler-category-5",
      },
      {
        slug: "table-lamps",
        title: "Table Lamps",
        image: "/api/reference-media/merchant-system-jonathan-adler-category-6",
      },
      {
        slug: "chandeliers",
        title: "Chandeliers",
        image: "/api/reference-media/merchant-system-jonathan-adler-category-7",
      },
      {
        slug: "bath-accessories",
        title: "Bath Accessories",
        image: "/api/reference-media/merchant-system-jonathan-adler-category-8",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-jonathan-adler-category-9",
      },
    ],
    avatar: "/api/reference-media/merchant-system-jonathan-adler-avatar",
    descriptionExpandable: true,
    reviewPhotos: [],
  },
  businesspleasureco: {
    source: "captured",
    background: "#898d77",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description:
      "Established in Summer 2016, Business & Pleasure Co. is a renowned lifestyle brand that captures the nostalgia and charm of vintage aesthetics through outdoor products. Inspired by a love for all things vintage and a dedication to quality, the brand creates timeless, durable, and beautiful outdoor pieces.",
    categories: [
      {
        slug: "towels-blankets",
        title: "Towels & Blankets",
        image:
          "/api/reference-media/merchant-system-business-pleasure-co-category-0",
      },
      {
        slug: "umbrella-bases",
        title: "Umbrella Bases",
        image:
          "/api/reference-media/merchant-system-business-pleasure-co-category-1",
      },
      {
        slug: "coolers-bags",
        title: "Coolers & Bags",
        image:
          "/api/reference-media/merchant-system-business-pleasure-co-category-2",
      },
      {
        slug: "umbrellas",
        title: "Umbrellas",
        image:
          "/api/reference-media/merchant-system-business-pleasure-co-category-3",
      },
      {
        slug: "home",
        title: "Home",
        image:
          "/api/reference-media/merchant-system-business-pleasure-co-category-4",
      },
      {
        slug: "chairs",
        title: "Chairs",
        image:
          "/api/reference-media/merchant-system-business-pleasure-co-category-5",
      },
      {
        slug: "furniture",
        title: "Furniture",
        image:
          "/api/reference-media/merchant-system-business-pleasure-co-category-6",
      },
      {
        slug: "beach",
        title: "Beach",
        image:
          "/api/reference-media/merchant-system-business-pleasure-co-category-7",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image:
          "/api/reference-media/merchant-system-business-pleasure-co-category-8",
        profileWide: true,
      },
    ],
    avatar: "/api/reference-media/merchant-system-business-pleasure-co-avatar",
    descriptionExpandable: true,
    reviewPhotos: [],
  },
  greenpanus: {
    source: "captured",
    background: "#b0acaa",
    foreground: "#111111",
    panel: "#ffffff40",
    description: "",
    categories: [
      {
        slug: "cookware-sets",
        title: "Cookware Sets",
        image: "/api/reference-media/merchant-system-greenpan-us-category-0",
      },
      {
        slug: "frypans",
        title: "Frypans",
        image: "/api/reference-media/merchant-system-greenpan-us-category-1",
      },
      {
        slug: "cutlery",
        title: "Cutlery",
        image: "/api/reference-media/merchant-system-greenpan-us-category-2",
      },
      {
        slug: "gifts",
        title: "Gifts",
        image: "/api/reference-media/merchant-system-greenpan-us-category-3",
      },
      {
        slug: "electrics",
        title: "Electrics",
        image: "/api/reference-media/merchant-system-greenpan-us-category-4",
      },
      {
        slug: "bakeware",
        title: "Bakeware",
        image: "/api/reference-media/merchant-system-greenpan-us-category-5",
      },
      {
        slug: "best-sellers",
        title: "Best Sellers",
        image: "/api/reference-media/merchant-system-greenpan-us-category-6",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-greenpan-us-category-7",
      },
    ],
    avatar: "/api/reference-media/merchant-system-greenpan-us-avatar",
    descriptionExpandable: false,
    reviewPhotos: [],
  },
  riflepaperco: {
    source: "captured",
    background: "#b79b85",
    foreground: "#111111",
    panel: "#ffffff40",
    description:
      "Rifle Paper Co. is a lifestyle brand that brings beauty to the everyday through Anna Bond’s handpainted artwork that can be found on stationery, accessories, and home decor.",
    categories: [
      {
        slug: "new-arrivals",
        title: "New Arrivals",
        image: "/api/reference-media/merchant-system-rifle-paper-co-category-0",
      },
      {
        slug: "best-sellers",
        title: "Best Sellers",
        image: "/api/reference-media/merchant-system-rifle-paper-co-category-1",
      },
      {
        slug: "home-decor",
        title: "Home Decor",
        image: "/api/reference-media/merchant-system-rifle-paper-co-category-2",
      },
      {
        slug: "desk-stationery",
        title: "Desk & Stationery",
        image: "/api/reference-media/merchant-system-rifle-paper-co-category-3",
      },
      {
        slug: "accessories-apparel",
        title: "Accessories & Apparel",
        image: "/api/reference-media/merchant-system-rifle-paper-co-category-4",
      },
      {
        slug: "cards-occasions",
        title: "Cards & Occasions",
        image: "/api/reference-media/merchant-system-rifle-paper-co-category-5",
      },
      {
        slug: "gifts",
        title: "Gifts",
        image: "/api/reference-media/merchant-system-rifle-paper-co-category-6",
      },
      {
        slug: "sale",
        title: "Sale",
        image: "/api/reference-media/merchant-system-rifle-paper-co-category-7",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-rifle-paper-co-category-8",
        profileWide: true,
      },
    ],
    avatar: "/api/reference-media/merchant-system-rifle-paper-co-avatar",
    descriptionExpandable: false,
    reviewPhotos: [],
  },
  nestnewyork: {
    source: "captured",
    background: "#bb8f68",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description:
      "Welcome to NEST NEW YORK, where mood is elevated and scent is celebrated. Our fragranced candles, diffusers, soaps, perfume, and gift collections transform the everyday with scents that transport, inspire and captivate the senses. Let NEST NEW YORK scent your world.",
    categories: [
      {
        slug: "perfumes",
        title: "Perfumes",
        image: "/api/reference-media/merchant-system-nest-new-york-category-0",
      },
      {
        slug: "candles-diffusers",
        title: "Candles & Diffusers",
        image: "/api/reference-media/merchant-system-nest-new-york-category-1",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-nest-new-york-category-2",
        profileWide: true,
      },
    ],
    avatar: "/api/reference-media/merchant-system-nest-new-york-avatar",
    descriptionExpandable: true,
    reviewPhotos: [],
  },
  hexcladcookware: {
    source: "captured",
    background: "#2b2725",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description: "",
    categories: [],
    avatar: "/api/reference-media/merchant-system-hexclad-cookware-avatar",
    descriptionExpandable: false,
    reviewPhotos: [
      "/api/reference-media/merchant-system-hexclad-cookware-review-photo-0",
      "/api/reference-media/merchant-system-hexclad-cookware-review-photo-1",
      "/api/reference-media/merchant-system-hexclad-cookware-review-photo-2",
      "/api/reference-media/merchant-system-hexclad-cookware-review-photo-3",
      "/api/reference-media/merchant-system-hexclad-cookware-review-photo-4",
    ],
  },
  hedleybennett: {
    source: "captured",
    background: "#6c5f49",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description:
      "Since 2012, we’ve been hustling to make the hardest working, best looking aprons and kitchen gear in the world. ",
    categories: [
      {
        slug: "collabs",
        title: "Collabs",
        image: "/api/reference-media/merchant-system-hedley-bennett-category-0",
      },
      {
        slug: "linens",
        title: "Linens",
        image: "/api/reference-media/merchant-system-hedley-bennett-category-1",
      },
      {
        slug: "tools",
        title: "Tools",
        image: "/api/reference-media/merchant-system-hedley-bennett-category-2",
      },
      {
        slug: "cookware",
        title: "Cookware",
        image: "/api/reference-media/merchant-system-hedley-bennett-category-3",
      },
      {
        slug: "bowls",
        title: "Bowls",
        image: "/api/reference-media/merchant-system-hedley-bennett-category-4",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-hedley-bennett-category-5",
      },
    ],
    avatar: "/api/reference-media/merchant-system-hedley-bennett-avatar",
    descriptionExpandable: false,
    reviewPhotos: [],
  },
  stanley1913: {
    source: "captured",
    background: "#8f837c",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description:
      "Stanley PMI Online Store | Offers an assortment of Vacuum Bottles, Mugs, thermoses, Cookware and more!",
    categories: [
      {
        slug: "bestsellers",
        title: "Bestsellers",
        image: "/api/reference-media/merchant-system-stanley-1913-category-0",
      },
      {
        slug: "coffee-tea",
        title: "Coffee & Tea",
        image: "/api/reference-media/merchant-system-stanley-1913-category-1",
      },
      {
        slug: "sale",
        title: "Sale",
        image: "/api/reference-media/merchant-system-stanley-1913-category-2",
      },
      {
        slug: "water-bottles",
        title: "Water Bottles",
        image: "/api/reference-media/merchant-system-stanley-1913-category-3",
      },
      {
        slug: "bags-backpacks-totes",
        title: "Bags, Backpacks, & Totes",
        image: "/api/reference-media/merchant-system-stanley-1913-category-4",
      },
      {
        slug: "barware",
        title: "Barware",
        image: "/api/reference-media/merchant-system-stanley-1913-category-5",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-stanley-1913-category-6",
        profileWide: true,
      },
    ],
    avatar: "/api/reference-media/merchant-system-stanley-1913-avatar",
    descriptionExpandable: false,
    reviewPhotos: [],
  },
  magnolia: {
    source: "captured",
    background: "#766248",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description:
      "Find timeless home décor, furniture, kitchen essentials, and lifestyle goods at Magnolia. Thoughtfully designed pieces that help you create a home with purpose.",
    categories: [
      {
        slug: "new-arrivals",
        title: "New Arrivals",
        image: "/api/reference-media/merchant-system-magnolia-category-0",
      },
      {
        slug: "furniture",
        title: "Furniture",
        image: "/api/reference-media/merchant-system-magnolia-category-1",
      },
      {
        slug: "decor",
        title: "Decor",
        image: "/api/reference-media/merchant-system-magnolia-category-2",
      },
      {
        slug: "wall-decor-mirrors",
        title: "Wall Decor + Mirrors",
        image: "/api/reference-media/merchant-system-magnolia-category-3",
      },
      {
        slug: "lighting",
        title: "Lighting",
        image: "/api/reference-media/merchant-system-magnolia-category-4",
      },
      {
        slug: "kitchen-tabletop",
        title: "Kitchen + Tabletop",
        image: "/api/reference-media/merchant-system-magnolia-category-5",
      },
      {
        slug: "bedding-duvets-sheets-shams",
        title: "Bedding: Duvets, Sheets & Shams",
        image: "/api/reference-media/merchant-system-magnolia-category-6",
      },
      {
        slug: "magnolia-home-rugs",
        title: "Magnolia Home Rugs",
        image: "/api/reference-media/merchant-system-magnolia-category-7",
      },
      {
        slug: "gifts-souvenirs",
        title: "Gifts + Souvenirs",
        image: "/api/reference-media/merchant-system-magnolia-category-8",
      },
      {
        slug: "best-sellers-guest-favorites",
        title: "Best Sellers + Guest Favorites",
        image: "/api/reference-media/merchant-system-magnolia-category-9",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-magnolia-category-10",
        profileWide: true,
      },
    ],
    avatar: "/api/reference-media/merchant-system-magnolia-avatar",
    descriptionExpandable: false,
    reviewPhotos: [],
  },
  maxandlily: {
    source: "captured",
    background: "#d8c3a9",
    foreground: "#111111",
    panel: "#ffffff40",
    description:
      "Your kid’s favorite Bunks and Lofts at prices you’ll absolutely love. Shop stylish, quality Kids Furniture, Mattresses and more. Free Shipping available.",
    categories: [
      {
        slug: "bunk-beds",
        title: "Bunk Beds",
        image: "/api/reference-media/merchant-system-max-and-lily-category-0",
      },
      {
        slug: "new-arrivals",
        title: "New Arrivals",
        image: "/api/reference-media/merchant-system-max-and-lily-category-1",
      },
      {
        slug: "teen-loft-beds",
        title: "Teen Loft Beds",
        image: "/api/reference-media/merchant-system-max-and-lily-category-2",
      },
      {
        slug: "kids-beds",
        title: "Kids Beds",
        image: "/api/reference-media/merchant-system-max-and-lily-category-3",
      },
      {
        slug: "dressers",
        title: "Dressers",
        image: "/api/reference-media/merchant-system-max-and-lily-category-4",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-max-and-lily-category-5",
      },
    ],
    avatar: "/api/reference-media/merchant-system-max-and-lily-avatar",
    descriptionExpandable: false,
    reviewPhotos: [],
  },
  coyuchi: {
    source: "captured",
    background: "#b9b49a",
    foreground: "#111111",
    panel: "#ffffff40",
    description:
      "Elevate your home with premium organic cotton bedding, sheets, towels, and sleepwear. Discover conscious luxury without compromise and connect to the raw power and beauty of nature.",
    categories: [
      {
        slug: "sheet-sets",
        title: "Sheet Sets",
        image: "/api/reference-media/merchant-system-coyuchi-category-0",
      },
      {
        slug: "new-arrivals",
        title: "New Arrivals",
        image: "/api/reference-media/merchant-system-coyuchi-category-1",
      },
      {
        slug: "bath-towels",
        title: "Bath Towels",
        image: "/api/reference-media/merchant-system-coyuchi-category-2",
      },
      {
        slug: "bed-inserts",
        title: "Bed Inserts",
        image: "/api/reference-media/merchant-system-coyuchi-category-3",
      },
      {
        slug: "sale-bedding-bath",
        title: "Sale Bedding + Bath",
        image: "/api/reference-media/merchant-system-coyuchi-category-4",
      },
      {
        slug: "home",
        title: "Home",
        image: "/api/reference-media/merchant-system-coyuchi-category-5",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-coyuchi-category-6",
        profileWide: true,
      },
    ],
    avatar: "/api/reference-media/merchant-system-coyuchi-avatar",
    descriptionExpandable: true,
    reviewPhotos: [],
  },
  pstrstudio: {
    source: "captured",
    background: "#766a64",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description: "",
    categories: [
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-pstr-studio-category-0",
        profileWide: true,
      },
    ],
    avatar: "/api/reference-media/merchant-system-pstr-studio-avatar",
    descriptionExpandable: false,
    reviewPhotos: [
      "/api/reference-media/merchant-system-pstr-studio-review-photo-0",
      "/api/reference-media/merchant-system-pstr-studio-review-photo-1",
      "/api/reference-media/merchant-system-pstr-studio-review-photo-2",
      "/api/reference-media/merchant-system-pstr-studio-review-photo-3",
      "/api/reference-media/merchant-system-pstr-studio-review-photo-4",
    ],
  },
  revivalrugs: {
    source: "captured",
    background: "#75593a",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description:
      "Handmade rugs from the world to your door. Free shipping, easy returns, and 20% off first purchase. Made with traditional techniques, natural materials, and no superfluous markups. ",
    categories: [
      {
        slug: "one-of-a-kind-rugs",
        title: "One-of-a-Kind Rugs",
        image: "/api/reference-media/merchant-system-revival-rugs-category-0",
      },
      {
        slug: "outdoor-rugs",
        title: "Outdoor Rugs",
        image: "/api/reference-media/merchant-system-revival-rugs-category-1",
      },
      {
        slug: "jute-rugs",
        title: "Jute Rugs",
        image: "/api/reference-media/merchant-system-revival-rugs-category-2",
      },
      {
        slug: "rug-pads",
        title: "Rug Pads",
        image: "/api/reference-media/merchant-system-revival-rugs-category-3",
      },
      {
        slug: "washable-and-easy-care-rugs",
        title: "Washable and Easy-Care Rugs",
        image: "/api/reference-media/merchant-system-revival-rugs-category-4",
      },
      {
        slug: "shop-all",
        title: "Shop all",
        image: "/api/reference-media/merchant-system-revival-rugs-category-5",
      },
    ],
    avatar: "/api/reference-media/merchant-system-revival-rugs-avatar",
    descriptionExpandable: true,
    reviewPhotos: [],
  },
  drift: {
    source: "captured",
    background: "#70644d",
    foreground: "#ffffff",
    panel: "#ffffff1a",
    description:
      "a scent based, home goods company, design forward and made to fit your lifestyle, without getting in the way. Those who appreciate beauty, we see you. ",
    categories: [],
    avatar: "/api/reference-media/merchant-system-drift-avatar",
    descriptionExpandable: false,
    reviewPhotos: [
      "/api/reference-media/merchant-system-drift-review-photo-0",
      "/api/reference-media/merchant-system-drift-review-photo-1",
      "/api/reference-media/merchant-system-drift-review-photo-2",
      "/api/reference-media/merchant-system-drift-review-photo-3",
      "/api/reference-media/merchant-system-drift-review-photo-4",
    ],
  },
};
