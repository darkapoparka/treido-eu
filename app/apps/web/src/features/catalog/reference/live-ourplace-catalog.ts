import type { MerchantCollection } from "../merchant-types";

// Source collection presentation only. The donor product/variant catalog is not imported.
export const nativeOurPlaceCollections: Readonly<
  Record<
    string,
    Pick<
      MerchantCollection,
      | "productIds"
      | "listings"
      | "showSaleFilter"
      | "defaultInStockOnly"
      | "inStockProductIds"
    >
  >
> = {
  cookware: {
    productIds: [
      "live-merchant-ourplace-titanium-pro-cookware-set",
      "live-merchant-ourplace-titanium-always-pan-pro",
      "live-merchant-ourplace-always-essential-cooking-pan",
      "live-merchant-ourplace-cookware-set",
      "live-merchant-ourplace-cookware-bakeware-set",
      "live-merchant-ourplace-titanium-pro-cookware-bakeware-set",
      "live-explore-perfect-pot",
      "live-merchant-ourplace-mini-always-pan",
      "live-merchant-ourplace-large-pan",
      "live-merchant-ourplace-cookware-duo",
      "live-merchant-ourplace-mini-cookware-duo",
      "live-merchant-ourplace-titanium-perfect-pot-pro",
      "live-merchant-ourplace-titanium-mini-perfect-pot-pro",
      "live-merchant-ourplace-titanium-mini-always-pan-pro",
      "live-merchant-ourplace-titanium-pro-cookware-duo",
      "live-merchant-ourplace-titanium-pro-mini-cookware-duo",
      "live-merchant-ourplace-always-pan-trio",
      "live-merchant-ourplace-always-pan-duo",
      "live-merchant-ourplace-mini-pot",
      "live-merchant-ourplace-essentials-complete-cookware-set-17-pc",
      "live-merchant-ourplace-essentials-cookware-bakeware-set-21-pc",
      "live-merchant-ourplace-essentials-cookware-set-11-pc",
      "live-merchant-ourplace-essentials-pan-trio-8pc",
      "live-home-new-11",
      "live-merchant-ourplace-cast-iron-always-pan",
      "live-merchant-ourplace-single-spruce-steamers",
      "live-merchant-ourplace-hot-grips",
      "live-merchant-ourplace-fry-deck",
      "live-merchant-ourplace-grill-press",
      "live-merchant-ourplace-fearless-fry",
      "live-merchant-ourplace-egg-poacher",
      "live-merchant-ourplace-flipping-platter",
      "live-merchant-ourplace-tagine",
      "live-merchant-ourplace-cooker-cups",
      "live-merchant-ourplace-metallic-knob-set",
      "live-merchant-ourplace-titanium-pro-always-pan-duo",
      "live-merchant-ourplace-carbon-steel-wok",
      "live-merchant-ourplace-dual-handle-always-pan",
      "live-merchant-ourplace-titanium-braiser-pro",
    ],
    listings: [
      {
        productId: "live-merchant-ourplace-titanium-pro-cookware-set",
        price: {
          amount: 54995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.6,
        ratingCount: "366",
        image:
          "/api/reference-media/merchant-ourplace-catalog-85d893c6c12aa5cc72da",
      },
      {
        productId: "live-merchant-ourplace-titanium-always-pan-pro",
        price: {
          amount: 17900,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.4,
        ratingCount: "1.7K",
        image:
          "/api/reference-media/merchant-ourplace-catalog-f61ea5d3ad39a1df37e6",
      },
      {
        productId: "live-merchant-ourplace-always-essential-cooking-pan",
        price: {
          amount: 13500,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.7,
        ratingCount: "5.3K",
        image:
          "/api/reference-media/merchant-ourplace-catalog-6ba6c36fc6bdc60dc575",
      },
      {
        productId: "live-merchant-ourplace-cookware-set",
        price: {
          amount: 35995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.5,
        ratingCount: "209",
        image:
          "/api/reference-media/merchant-ourplace-catalog-77d3d9d7ef266254f651",
      },
      {
        productId: "live-merchant-ourplace-cookware-bakeware-set",
        price: {
          amount: 49995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.6,
        ratingCount: "78",
        image:
          "/api/reference-media/merchant-ourplace-catalog-ef49ac37bce91f12b923",
      },
      {
        productId: "live-merchant-ourplace-titanium-pro-cookware-bakeware-set",
        price: {
          amount: 67495,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.4,
        ratingCount: "96",
        image:
          "/api/reference-media/merchant-ourplace-catalog-a43a7b5abf2b41356675",
      },
      {
        productId: "live-explore-perfect-pot",
        price: {
          amount: 14900,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.8,
        ratingCount: "8.8K",
        image:
          "/api/reference-media/merchant-ourplace-catalog-09f7b753eb6b9e66510f",
      },
      {
        productId: "live-merchant-ourplace-mini-always-pan",
        price: {
          amount: 10900,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.8,
        ratingCount: "5.9K",
        image:
          "/api/reference-media/merchant-ourplace-catalog-43fa3f89e4aef5281115",
      },
      {
        productId: "live-merchant-ourplace-large-pan",
        price: {
          amount: 15900,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.7,
        ratingCount: "1.4K",
        image: "/api/reference-media/merchant-ourplace-large-pan-photo-1",
      },
      {
        productId: "live-merchant-ourplace-cookware-duo",
        price: {
          amount: 23995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.6,
        ratingCount: "114",
        image:
          "/api/reference-media/merchant-ourplace-catalog-f026d9b6bcd54c0fb9aa",
      },
      {
        productId: "live-merchant-ourplace-mini-cookware-duo",
        price: {
          amount: 20995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.7,
        ratingCount: "130",
        image:
          "/api/reference-media/merchant-ourplace-catalog-ed9c6650045b0ad0fbfe",
      },
      {
        productId: "live-merchant-ourplace-titanium-perfect-pot-pro",
        price: {
          amount: 19500,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.9,
        ratingCount: "131",
        image:
          "/api/reference-media/merchant-ourplace-catalog-8432b145cd80d9183e13",
      },
      {
        productId: "live-merchant-ourplace-titanium-mini-perfect-pot-pro",
        price: {
          amount: 16900,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.9,
        ratingCount: "130",
        image:
          "/api/reference-media/merchant-ourplace-catalog-39021f7d15cfbe067856",
      },
      {
        productId: "live-merchant-ourplace-titanium-mini-always-pan-pro",
        price: {
          amount: 15500,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.7,
        ratingCount: "320",
        image:
          "/api/reference-media/merchant-ourplace-catalog-d1c610255b21aa80a646",
      },
      {
        productId: "live-merchant-ourplace-titanium-pro-cookware-duo",
        price: {
          amount: 32495,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.7,
        ratingCount: "37",
        image:
          "/api/reference-media/merchant-ourplace-catalog-77512b334f564d6b6b9e",
      },
      {
        productId: "live-merchant-ourplace-titanium-pro-mini-cookware-duo",
        price: {
          amount: 28995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.7,
        ratingCount: "105",
        image:
          "/api/reference-media/merchant-ourplace-catalog-5eb06b81b2e9c44c76d0",
      },
      {
        productId: "live-merchant-ourplace-always-pan-trio",
        price: {
          amount: 29995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.7,
        ratingCount: "39",
        image:
          "/api/reference-media/merchant-ourplace-catalog-adf4bbdafc7226196707",
      },
      {
        productId: "live-merchant-ourplace-always-pan-duo",
        price: {
          amount: 24495,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.8,
        ratingCount: "42",
        image:
          "/api/reference-media/merchant-ourplace-catalog-9bb998c2a07b13d52da0",
      },
      {
        productId: "live-merchant-ourplace-mini-pot",
        price: {
          amount: 12500,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.8,
        ratingCount: "4.4K",
        image: "/api/reference-media/merchant-ourplace-mini-pot-photo-41",
      },
      {
        productId:
          "live-merchant-ourplace-essentials-complete-cookware-set-17-pc",
        price: {
          amount: 54995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.7,
        ratingCount: "30",
        image:
          "/api/reference-media/merchant-ourplace-catalog-7a995a0f98f9a8baad7a",
      },
      {
        productId:
          "live-merchant-ourplace-essentials-cookware-bakeware-set-21-pc",
        price: {
          amount: 64995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.4,
        ratingCount: "33",
        image:
          "/api/reference-media/merchant-ourplace-catalog-0b6a8fc6d482b4a939ca",
      },
      {
        productId: "live-merchant-ourplace-essentials-cookware-set-11-pc",
        price: {
          amount: 34995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.3,
        ratingCount: "25",
        image:
          "/api/reference-media/merchant-ourplace-catalog-e938f702d8b4637b8bee",
      },
      {
        productId: "live-merchant-ourplace-essentials-pan-trio-8pc",
        price: {
          amount: 24995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.6,
        ratingCount: "40",
        image:
          "/api/reference-media/merchant-ourplace-catalog-a0652238b0f4c034b2d6",
      },
      {
        productId: "live-home-new-11",
        price: {
          amount: 12495,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.5,
        ratingCount: "20",
        image:
          "/api/reference-media/merchant-ourplace-catalog-3b7d03d6b4c763762111",
      },
      {
        productId: "live-merchant-ourplace-cast-iron-always-pan",
        price: {
          amount: 13500,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.6,
        ratingCount: "1.2K",
        image:
          "/api/reference-media/merchant-ourplace-catalog-92aa271e14e1ec12f586",
      },
      {
        productId: "live-merchant-ourplace-single-spruce-steamers",
        price: {
          amount: 3500,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.6,
        ratingCount: "2.4K",
        image:
          "/api/reference-media/merchant-ourplace-catalog-50d34221e88ae562413c",
      },
      {
        productId: "live-merchant-ourplace-hot-grips",
        price: {
          amount: 2900,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.7,
        ratingCount: "1.7K",
        image:
          "/api/reference-media/merchant-ourplace-catalog-d441474002cc6ad7b56f",
      },
      {
        productId: "live-merchant-ourplace-fry-deck",
        price: {
          amount: 3500,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.8,
        ratingCount: "716",
        image:
          "/api/reference-media/merchant-ourplace-catalog-5774c430c0386eeb2e3c",
      },
      {
        productId: "live-merchant-ourplace-grill-press",
        price: {
          amount: 4500,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.9,
        ratingCount: "513",
        image:
          "/api/reference-media/merchant-ourplace-catalog-2a8762c4a30f9833e44a",
      },
      {
        productId: "live-merchant-ourplace-fearless-fry",
        price: {
          amount: 3900,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.8,
        ratingCount: "534",
        image:
          "/api/reference-media/merchant-ourplace-catalog-ff18528c716ee73358a1",
      },
      {
        productId: "live-merchant-ourplace-egg-poacher",
        price: {
          amount: 4900,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.3,
        ratingCount: "458",
        image:
          "/api/reference-media/merchant-ourplace-catalog-abc8b54740f0bcc7259e",
      },
      {
        productId: "live-merchant-ourplace-flipping-platter",
        price: {
          amount: 2799,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.6,
        ratingCount: "262",
        image:
          "/api/reference-media/merchant-ourplace-catalog-80e58743b6d16170dbc4",
      },
      {
        productId: "live-merchant-ourplace-tagine",
        price: {
          amount: 5599,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.7,
        ratingCount: "294",
        image:
          "/api/reference-media/merchant-ourplace-catalog-8dfe2ebc7837cc3fe5f2",
      },
      {
        productId: "live-merchant-ourplace-cooker-cups",
        price: {
          amount: 2699,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.8,
        ratingCount: "102",
        image:
          "/api/reference-media/merchant-ourplace-catalog-362959f0f338077b8d58",
      },
      {
        productId: "live-merchant-ourplace-metallic-knob-set",
        price: {
          amount: 3899,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.8,
        ratingCount: "17",
        image:
          "/api/reference-media/merchant-ourplace-catalog-bd30cfb2b353312e1386",
      },
      {
        productId: "live-merchant-ourplace-titanium-pro-always-pan-duo",
        price: {
          amount: 29995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.5,
        ratingCount: "152",
        image:
          "/api/reference-media/merchant-ourplace-catalog-caee73edc92cb1b82a44",
      },
      {
        productId: "live-merchant-ourplace-carbon-steel-wok",
        price: {
          amount: 18900,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.6,
        ratingCount: "48",
        image:
          "/api/reference-media/merchant-ourplace-catalog-992b9578b051fef996aa",
      },
      {
        productId: "live-merchant-ourplace-dual-handle-always-pan",
        price: {
          amount: 16500,
          currency: "USD",
        },
        compareAt: null,
        image:
          "/api/reference-media/merchant-ourplace-catalog-fcdfd0ff30e80de75197",
      },
      {
        productId: "live-merchant-ourplace-titanium-braiser-pro",
        price: {
          amount: 22500,
          currency: "USD",
        },
        compareAt: null,
        image:
          "/api/reference-media/merchant-ourplace-catalog-12b332da5053ea9cc42e",
      },
    ],
    showSaleFilter: true,
    defaultInStockOnly: true,
    inStockProductIds: [
      "live-merchant-ourplace-titanium-pro-cookware-set",
      "live-merchant-ourplace-titanium-always-pan-pro",
      "live-merchant-ourplace-always-essential-cooking-pan",
      "live-merchant-ourplace-cookware-set",
      "live-merchant-ourplace-cookware-bakeware-set",
      "live-merchant-ourplace-titanium-pro-cookware-bakeware-set",
      "live-explore-perfect-pot",
      "live-merchant-ourplace-mini-always-pan",
      "live-merchant-ourplace-large-pan",
      "live-merchant-ourplace-cookware-duo",
      "live-merchant-ourplace-mini-cookware-duo",
      "live-merchant-ourplace-titanium-perfect-pot-pro",
      "live-merchant-ourplace-titanium-mini-perfect-pot-pro",
      "live-merchant-ourplace-titanium-mini-always-pan-pro",
      "live-merchant-ourplace-titanium-pro-cookware-duo",
      "live-merchant-ourplace-titanium-pro-mini-cookware-duo",
      "live-merchant-ourplace-always-pan-trio",
      "live-merchant-ourplace-always-pan-duo",
      "live-merchant-ourplace-mini-pot",
      "live-merchant-ourplace-essentials-complete-cookware-set-17-pc",
      "live-merchant-ourplace-essentials-cookware-bakeware-set-21-pc",
      "live-merchant-ourplace-essentials-cookware-set-11-pc",
      "live-merchant-ourplace-essentials-pan-trio-8pc",
      "live-home-new-11",
      "live-merchant-ourplace-cast-iron-always-pan",
      "live-merchant-ourplace-single-spruce-steamers",
      "live-merchant-ourplace-hot-grips",
      "live-merchant-ourplace-fry-deck",
      "live-merchant-ourplace-grill-press",
      "live-merchant-ourplace-fearless-fry",
      "live-merchant-ourplace-egg-poacher",
      "live-merchant-ourplace-flipping-platter",
      "live-merchant-ourplace-tagine",
      "live-merchant-ourplace-cooker-cups",
      "live-merchant-ourplace-metallic-knob-set",
      "live-merchant-ourplace-titanium-pro-always-pan-duo",
      "live-merchant-ourplace-carbon-steel-wok",
      "live-merchant-ourplace-dual-handle-always-pan",
      "live-merchant-ourplace-titanium-braiser-pro",
    ],
  },
  bundles: {
    productIds: [
      "live-merchant-ourplace-titanium-pro-cookware-set",
      "live-merchant-ourplace-titanium-pro-cookware-bakeware-set",
      "live-merchant-ourplace-cookware-set",
      "live-merchant-ourplace-cookware-bakeware-set",
      "live-merchant-ourplace-ultimate-bakeware-set",
      "live-merchant-ourplace-cookware-duo",
      "live-merchant-ourplace-mini-cookware-duo",
      "live-merchant-ourplace-always-pan-duo",
      "live-merchant-ourplace-always-pan-trio",
      "live-merchant-ourplace-essentials-cookware-bakeware-set-21-pc",
      "live-merchant-ourplace-essentials-complete-cookware-set-17-pc",
      "live-merchant-ourplace-essentials-cookware-set-11-pc",
      "live-merchant-ourplace-essentials-pan-trio-8pc",
      "live-merchant-ourplace-titanium-pro-cookware-duo",
      "live-merchant-ourplace-titanium-pro-mini-cookware-duo",
      "live-merchant-ourplace-essentials-griddle-pan-set",
      "live-merchant-ourplace-bakeware-trio",
      "live-merchant-ourplace-knife-trio-bundle",
    ],
    listings: [
      {
        productId: "live-merchant-ourplace-titanium-pro-cookware-set",
        price: {
          amount: 54995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.6,
        ratingCount: "366",
        image:
          "/api/reference-media/merchant-ourplace-catalog-85d893c6c12aa5cc72da",
      },
      {
        productId: "live-merchant-ourplace-titanium-pro-cookware-bakeware-set",
        price: {
          amount: 67495,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.4,
        ratingCount: "96",
        image:
          "/api/reference-media/merchant-ourplace-catalog-a43a7b5abf2b41356675",
      },
      {
        productId: "live-merchant-ourplace-cookware-set",
        price: {
          amount: 35995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.5,
        ratingCount: "209",
        image:
          "/api/reference-media/merchant-ourplace-catalog-77d3d9d7ef266254f651",
      },
      {
        productId: "live-merchant-ourplace-cookware-bakeware-set",
        price: {
          amount: 49995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.6,
        ratingCount: "78",
        image:
          "/api/reference-media/merchant-ourplace-catalog-ef49ac37bce91f12b923",
      },
      {
        productId: "live-merchant-ourplace-ultimate-bakeware-set",
        price: {
          amount: 26995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.7,
        ratingCount: "60",
        image:
          "/api/reference-media/merchant-ourplace-catalog-eed88729173d651c51fc",
      },
      {
        productId: "live-merchant-ourplace-cookware-duo",
        price: {
          amount: 23995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.6,
        ratingCount: "114",
        image:
          "/api/reference-media/merchant-ourplace-catalog-f026d9b6bcd54c0fb9aa",
      },
      {
        productId: "live-merchant-ourplace-mini-cookware-duo",
        price: {
          amount: 20995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.7,
        ratingCount: "130",
        image:
          "/api/reference-media/merchant-ourplace-catalog-ed9c6650045b0ad0fbfe",
      },
      {
        productId: "live-merchant-ourplace-always-pan-duo",
        price: {
          amount: 24495,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.8,
        ratingCount: "42",
        image:
          "/api/reference-media/merchant-ourplace-catalog-9bb998c2a07b13d52da0",
      },
      {
        productId: "live-merchant-ourplace-always-pan-trio",
        price: {
          amount: 29995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.7,
        ratingCount: "39",
        image:
          "/api/reference-media/merchant-ourplace-catalog-adf4bbdafc7226196707",
      },
      {
        productId:
          "live-merchant-ourplace-essentials-cookware-bakeware-set-21-pc",
        price: {
          amount: 64995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.4,
        ratingCount: "33",
        image:
          "/api/reference-media/merchant-ourplace-catalog-0b6a8fc6d482b4a939ca",
      },
      {
        productId:
          "live-merchant-ourplace-essentials-complete-cookware-set-17-pc",
        price: {
          amount: 54995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.7,
        ratingCount: "30",
        image:
          "/api/reference-media/merchant-ourplace-catalog-7a995a0f98f9a8baad7a",
      },
      {
        productId: "live-merchant-ourplace-essentials-cookware-set-11-pc",
        price: {
          amount: 34995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.3,
        ratingCount: "25",
        image:
          "/api/reference-media/merchant-ourplace-catalog-e938f702d8b4637b8bee",
      },
      {
        productId: "live-merchant-ourplace-essentials-pan-trio-8pc",
        price: {
          amount: 24995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.6,
        ratingCount: "40",
        image:
          "/api/reference-media/merchant-ourplace-catalog-a0652238b0f4c034b2d6",
      },
      {
        productId: "live-merchant-ourplace-titanium-pro-cookware-duo",
        price: {
          amount: 32495,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.7,
        ratingCount: "37",
        image:
          "/api/reference-media/merchant-ourplace-catalog-77512b334f564d6b6b9e",
      },
      {
        productId: "live-merchant-ourplace-titanium-pro-mini-cookware-duo",
        price: {
          amount: 28995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.7,
        ratingCount: "105",
        image:
          "/api/reference-media/merchant-ourplace-catalog-5eb06b81b2e9c44c76d0",
      },
      {
        productId: "live-merchant-ourplace-essentials-griddle-pan-set",
        price: {
          amount: 16995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.9,
        ratingCount: "38",
        image:
          "/api/reference-media/merchant-ourplace-catalog-7aedeaacef011c6c1bb4",
      },
      {
        productId: "live-merchant-ourplace-bakeware-trio",
        price: {
          amount: 18495,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.8,
        ratingCount: "65",
        image:
          "/api/reference-media/merchant-ourplace-catalog-8a96da7ad81a1dd29208",
      },
      {
        productId: "live-merchant-ourplace-knife-trio-bundle",
        price: {
          amount: 14495,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.8,
        ratingCount: "560",
        image:
          "/api/reference-media/merchant-ourplace-catalog-fdfbcc814117c52623c4",
      },
    ],
    showSaleFilter: true,
    defaultInStockOnly: true,
    inStockProductIds: [
      "live-merchant-ourplace-titanium-pro-cookware-set",
      "live-merchant-ourplace-titanium-pro-cookware-bakeware-set",
      "live-merchant-ourplace-cookware-set",
      "live-merchant-ourplace-cookware-bakeware-set",
      "live-merchant-ourplace-ultimate-bakeware-set",
      "live-merchant-ourplace-cookware-duo",
      "live-merchant-ourplace-mini-cookware-duo",
      "live-merchant-ourplace-always-pan-duo",
      "live-merchant-ourplace-always-pan-trio",
      "live-merchant-ourplace-essentials-cookware-bakeware-set-21-pc",
      "live-merchant-ourplace-essentials-complete-cookware-set-17-pc",
      "live-merchant-ourplace-essentials-cookware-set-11-pc",
      "live-merchant-ourplace-essentials-pan-trio-8pc",
      "live-merchant-ourplace-titanium-pro-cookware-duo",
      "live-merchant-ourplace-titanium-pro-mini-cookware-duo",
      "live-merchant-ourplace-essentials-griddle-pan-set",
      "live-merchant-ourplace-bakeware-trio",
      "live-merchant-ourplace-knife-trio-bundle",
    ],
  },
  appliances: {
    productIds: [
      "live-merchant-ourplace-wonder-oven-pro",
      "live-merchant-ourplace-dream-cooker",
      "live-merchant-ourplace-large-wonder-oven",
      "live-merchant-ourplace-wonder-oven",
      "live-merchant-ourplace-wonder-oven-pro-essentials-kit",
      "live-merchant-ourplace-wonder-oven-pro-chefs-kit",
      "live-merchant-ourplace-large-wonder-oven-essentials-kit",
      "live-merchant-ourplace-wonder-oven-essentials-kit",
      "live-merchant-ourplace-wonder-oven-baker-s-kit",
      "live-merchant-ourplace-splendor-blender",
      "live-merchant-ourplace-wonder-oven-pro-titanium-braiser-pro",
    ],
    listings: [
      {
        productId: "live-merchant-ourplace-wonder-oven-pro",
        price: {
          amount: 32500,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.6,
        ratingCount: "350",
        image:
          "/api/reference-media/merchant-ourplace-catalog-f3ecc7f8d291450057de",
      },
      {
        productId: "live-merchant-ourplace-dream-cooker",
        price: {
          amount: 19900,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.7,
        ratingCount: "501",
        image:
          "/api/reference-media/merchant-ourplace-catalog-fda08a3287fc578d4ac0",
      },
      {
        productId: "live-merchant-ourplace-large-wonder-oven",
        price: {
          amount: 24500,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.3,
        ratingCount: "440",
        image:
          "/api/reference-media/merchant-ourplace-catalog-5b00db7ea2a1ad54c3dc",
      },
      {
        productId: "live-merchant-ourplace-wonder-oven",
        price: {
          amount: 18500,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.5,
        ratingCount: "3K",
        image:
          "/api/reference-media/merchant-ourplace-catalog-d445848bc3c1a90d282f",
      },
      {
        productId: "live-merchant-ourplace-wonder-oven-pro-essentials-kit",
        price: {
          amount: 7900,
          currency: "USD",
        },
        compareAt: null,
        rating: 4,
        ratingCount: "26",
        image:
          "/api/reference-media/merchant-ourplace-catalog-b0b4b22497a530447f94",
      },
      {
        productId: "live-merchant-ourplace-wonder-oven-pro-chefs-kit",
        price: {
          amount: 8900,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.6,
        ratingCount: "67",
        image:
          "/api/reference-media/merchant-ourplace-catalog-ebbda51fa8363806c69e",
      },
      {
        productId: "live-merchant-ourplace-large-wonder-oven-essentials-kit",
        price: {
          amount: 6500,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.4,
        ratingCount: "64",
        image:
          "/api/reference-media/merchant-ourplace-catalog-34eabfd19a93daad0a4b",
      },
      {
        productId: "live-merchant-ourplace-wonder-oven-essentials-kit",
        price: {
          amount: 4900,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.6,
        ratingCount: "660",
        image:
          "/api/reference-media/merchant-ourplace-catalog-bdc648e97393046bd29d",
      },
      {
        productId: "live-merchant-ourplace-wonder-oven-baker-s-kit",
        price: {
          amount: 7900,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.8,
        ratingCount: "239",
        image:
          "/api/reference-media/merchant-ourplace-catalog-1362b42e40ddd2b5326d",
      },
      {
        productId: "live-merchant-ourplace-splendor-blender",
        price: {
          amount: 11900,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.5,
        ratingCount: "43",
        image:
          "/api/reference-media/merchant-ourplace-catalog-e1a38c6cfd8afb4655da",
      },
      {
        productId:
          "live-merchant-ourplace-wonder-oven-pro-titanium-braiser-pro",
        price: {
          amount: 55995,
          currency: "USD",
        },
        compareAt: null,
        image:
          "/api/reference-media/merchant-ourplace-catalog-3b4309d8f753d6ab03d2",
      },
    ],
    showSaleFilter: true,
    defaultInStockOnly: true,
    inStockProductIds: [
      "live-merchant-ourplace-wonder-oven-pro",
      "live-merchant-ourplace-dream-cooker",
      "live-merchant-ourplace-large-wonder-oven",
      "live-merchant-ourplace-wonder-oven",
      "live-merchant-ourplace-wonder-oven-pro-essentials-kit",
      "live-merchant-ourplace-wonder-oven-pro-chefs-kit",
      "live-merchant-ourplace-large-wonder-oven-essentials-kit",
      "live-merchant-ourplace-wonder-oven-essentials-kit",
      "live-merchant-ourplace-wonder-oven-baker-s-kit",
      "live-merchant-ourplace-splendor-blender",
      "live-merchant-ourplace-wonder-oven-pro-titanium-braiser-pro",
    ],
  },
  bakeware: {
    productIds: [
      "live-merchant-ourplace-ultimate-bakeware-set",
      "live-merchant-ourplace-bakeware-set",
      "live-merchant-ourplace-bakeware-trio",
      "live-merchant-ourplace-essentials-griddle-pan-set",
      "live-merchant-ourplace-griddle-pan",
      "live-merchant-ourplace-mini-griddle-pan",
      "live-merchant-ourplace-oven-rack",
      "live-merchant-ourplace-oven-mats",
      "live-merchant-ourplace-mini-oven-mats",
      "live-merchant-ourplace-titanium-pro-cookware-bakeware-set",
      "live-merchant-ourplace-cookware-bakeware-set",
      "live-merchant-ourplace-essentials-cookware-bakeware-set-21-pc",
    ],
    listings: [
      {
        productId: "live-merchant-ourplace-ultimate-bakeware-set",
        price: {
          amount: 26995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.7,
        ratingCount: "60",
        image:
          "/api/reference-media/merchant-ourplace-catalog-eed88729173d651c51fc",
      },
      {
        productId: "live-merchant-ourplace-bakeware-set",
        price: {
          amount: 19995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.8,
        ratingCount: "1.6K",
        image:
          "/api/reference-media/merchant-ourplace-catalog-ec75a2bfd63b05fca09d",
      },
      {
        productId: "live-merchant-ourplace-bakeware-trio",
        price: {
          amount: 18495,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.8,
        ratingCount: "65",
        image:
          "/api/reference-media/merchant-ourplace-catalog-8a96da7ad81a1dd29208",
      },
      {
        productId: "live-merchant-ourplace-essentials-griddle-pan-set",
        price: {
          amount: 16995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.9,
        ratingCount: "38",
        image:
          "/api/reference-media/merchant-ourplace-catalog-7aedeaacef011c6c1bb4",
      },
      {
        productId: "live-merchant-ourplace-griddle-pan",
        price: {
          amount: 11900,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.8,
        ratingCount: "1.7K",
        image:
          "/api/reference-media/merchant-ourplace-catalog-5d1207f780c4564e48b6",
      },
      {
        productId: "live-merchant-ourplace-mini-griddle-pan",
        price: {
          amount: 6900,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.9,
        ratingCount: "563",
        image:
          "/api/reference-media/merchant-ourplace-catalog-2314d054ae6fc3e95441",
      },
      {
        productId: "live-merchant-ourplace-oven-rack",
        price: {
          amount: 4500,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.9,
        ratingCount: "249",
        image:
          "/api/reference-media/merchant-ourplace-catalog-2fa15eba02cbc00e35d2",
      },
      {
        productId: "live-merchant-ourplace-oven-mats",
        price: {
          amount: 4500,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.8,
        ratingCount: "300",
        image:
          "/api/reference-media/merchant-ourplace-catalog-a99e469f8b84f19cd21a",
      },
      {
        productId: "live-merchant-ourplace-mini-oven-mats",
        price: {
          amount: 3500,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.9,
        ratingCount: "145",
        image:
          "/api/reference-media/merchant-ourplace-catalog-f65d65e4a5ff6afd1350",
      },
      {
        productId: "live-merchant-ourplace-titanium-pro-cookware-bakeware-set",
        price: {
          amount: 67495,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.4,
        ratingCount: "96",
        image:
          "/api/reference-media/merchant-ourplace-catalog-a43a7b5abf2b41356675",
      },
      {
        productId: "live-merchant-ourplace-cookware-bakeware-set",
        price: {
          amount: 49995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.6,
        ratingCount: "78",
        image:
          "/api/reference-media/merchant-ourplace-catalog-ef49ac37bce91f12b923",
      },
      {
        productId:
          "live-merchant-ourplace-essentials-cookware-bakeware-set-21-pc",
        price: {
          amount: 64995,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.4,
        ratingCount: "33",
        image:
          "/api/reference-media/merchant-ourplace-catalog-0b6a8fc6d482b4a939ca",
      },
    ],
    showSaleFilter: true,
    defaultInStockOnly: true,
    inStockProductIds: [
      "live-merchant-ourplace-ultimate-bakeware-set",
      "live-merchant-ourplace-bakeware-set",
      "live-merchant-ourplace-bakeware-trio",
      "live-merchant-ourplace-essentials-griddle-pan-set",
      "live-merchant-ourplace-griddle-pan",
      "live-merchant-ourplace-mini-griddle-pan",
      "live-merchant-ourplace-oven-rack",
      "live-merchant-ourplace-oven-mats",
      "live-merchant-ourplace-mini-oven-mats",
      "live-merchant-ourplace-titanium-pro-cookware-bakeware-set",
      "live-merchant-ourplace-cookware-bakeware-set",
      "live-merchant-ourplace-essentials-cookware-bakeware-set-21-pc",
    ],
  },
  tableware: {
    productIds: [
      "live-merchant-ourplace-serving-set",
      "live-merchant-ourplace-dinner-plates",
      "live-merchant-ourplace-salad-plates",
      "live-merchant-ourplace-soup-bowls",
      "live-merchant-ourplace-dessert-plates",
      "live-merchant-ourplace-tiny-plates",
      "live-merchant-ourplace-ceramic-tiny-bowls",
      "live-merchant-ourplace-tall-night-day-glasses",
      "live-merchant-ourplace-night-day-glasses",
      "live-merchant-ourplace-night-day-carafe",
      "live-merchant-ourplace-serving-bowls",
      "live-merchant-ourplace-serving-platters",
      "live-merchant-ourplace-night-day-mugs",
      "live-merchant-ourplace-pleat-trivet",
      "live-merchant-ourplace-the-main-plate",
      "live-merchant-ourplace-rice-bowl-set",
      "live-merchant-ourplace-small-plates-set",
    ],
    listings: [
      {
        productId: "live-merchant-ourplace-serving-set",
        price: {
          amount: 18495,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.7,
        ratingCount: "20",
        image:
          "/api/reference-media/merchant-ourplace-catalog-39d8823ab090bd4bb69e",
      },
      {
        productId: "live-merchant-ourplace-dinner-plates",
        price: {
          amount: 8500,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.7,
        ratingCount: "630",
        image:
          "/api/reference-media/merchant-ourplace-catalog-b59fe86c146bb2db0601",
      },
      {
        productId: "live-merchant-ourplace-salad-plates",
        price: {
          amount: 7500,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.8,
        ratingCount: "551",
        image:
          "/api/reference-media/merchant-ourplace-catalog-82d69acb62aa05bdeffd",
      },
      {
        productId: "live-merchant-ourplace-soup-bowls",
        price: {
          amount: 4899,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.8,
        ratingCount: "526",
        image:
          "/api/reference-media/merchant-ourplace-catalog-5de9d41eb36a810a385e",
      },
      {
        productId: "live-merchant-ourplace-dessert-plates",
        price: {
          amount: 3599,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.9,
        ratingCount: "312",
        image:
          "/api/reference-media/merchant-ourplace-catalog-9532df678c8f972a932d",
      },
      {
        productId: "live-merchant-ourplace-tiny-plates",
        price: {
          amount: 2899,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.9,
        ratingCount: "133",
        image:
          "/api/reference-media/merchant-ourplace-catalog-aab837ee8c315583f565",
      },
      {
        productId: "live-merchant-ourplace-ceramic-tiny-bowls",
        price: {
          amount: 2399,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.9,
        ratingCount: "241",
        image:
          "/api/reference-media/merchant-ourplace-catalog-3404b2f85ca8b14c885d",
      },
      {
        productId: "live-merchant-ourplace-tall-night-day-glasses",
        price: {
          amount: 7900,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.7,
        ratingCount: "161",
        image:
          "/api/reference-media/merchant-ourplace-catalog-007459feed5915b464a3",
      },
      {
        productId: "live-merchant-ourplace-night-day-glasses",
        price: {
          amount: 5900,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.8,
        ratingCount: "1.8K",
        image:
          "/api/reference-media/merchant-ourplace-catalog-af894ea6517019743c92",
      },
      {
        productId: "live-merchant-ourplace-night-day-carafe",
        price: {
          amount: 8399,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.7,
        ratingCount: "188",
        image:
          "/api/reference-media/merchant-ourplace-catalog-8da2b1b6dae77e71ed43",
      },
      {
        productId: "live-merchant-ourplace-serving-bowls",
        price: {
          amount: 6399,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.9,
        ratingCount: "224",
        image:
          "/api/reference-media/merchant-ourplace-catalog-36b5e1307dd20b348add",
      },
      {
        productId: "live-merchant-ourplace-serving-platters",
        price: {
          amount: 3799,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.9,
        ratingCount: "263",
        image:
          "/api/reference-media/merchant-ourplace-catalog-b2b27bacb21ed20da43c",
      },
      {
        productId: "live-merchant-ourplace-night-day-mugs",
        price: {
          amount: 4199,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.8,
        ratingCount: "230",
        image:
          "/api/reference-media/merchant-ourplace-catalog-a13caaf09556fa4784ae",
      },
      {
        productId: "live-merchant-ourplace-pleat-trivet",
        price: {
          amount: 3900,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.8,
        ratingCount: "195",
        image:
          "/api/reference-media/merchant-ourplace-catalog-3dc78da257267b4c89c6",
      },
      {
        productId: "live-merchant-ourplace-the-main-plate",
        price: {
          amount: 2799,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.6,
        ratingCount: "1.8K",
        image:
          "/api/reference-media/merchant-ourplace-catalog-ccfcdddf68061308f014",
      },
      {
        productId: "live-merchant-ourplace-rice-bowl-set",
        price: {
          amount: 6500,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.9,
        ratingCount: "66",
        image:
          "/api/reference-media/merchant-ourplace-catalog-5ae70b1e71cc0c364f2e",
      },
      {
        productId: "live-merchant-ourplace-small-plates-set",
        price: {
          amount: 6900,
          currency: "USD",
        },
        compareAt: null,
        image:
          "/api/reference-media/merchant-ourplace-catalog-eed90862944df011704b",
      },
    ],
    showSaleFilter: true,
    defaultInStockOnly: true,
    inStockProductIds: [
      "live-merchant-ourplace-serving-set",
      "live-merchant-ourplace-dinner-plates",
      "live-merchant-ourplace-salad-plates",
      "live-merchant-ourplace-soup-bowls",
      "live-merchant-ourplace-dessert-plates",
      "live-merchant-ourplace-tiny-plates",
      "live-merchant-ourplace-ceramic-tiny-bowls",
      "live-merchant-ourplace-tall-night-day-glasses",
      "live-merchant-ourplace-night-day-glasses",
      "live-merchant-ourplace-night-day-carafe",
      "live-merchant-ourplace-serving-bowls",
      "live-merchant-ourplace-serving-platters",
      "live-merchant-ourplace-night-day-mugs",
      "live-merchant-ourplace-pleat-trivet",
      "live-merchant-ourplace-the-main-plate",
      "live-merchant-ourplace-rice-bowl-set",
      "live-merchant-ourplace-small-plates-set",
    ],
  },
  "kitchen-tools": {
    productIds: [
      "live-merchant-ourplace-utensil-essentials",
      "live-merchant-ourplace-knife-trio-bundle",
      "live-merchant-ourplace-home-cook-apron",
      "live-merchant-ourplace-hot-mitts",
      "live-merchant-ourplace-double-dish-towels",
      "live-merchant-ourplace-loop-napkins",
      "live-merchant-ourplace-hosting-apron",
      "live-merchant-ourplace-shear-genius",
      "live-merchant-ourplace-chefs-knife",
      "live-merchant-ourplace-paring-knife",
      "live-merchant-ourplace-serrated-knife",
      "live-merchant-ourplace-beechwood-spatulas",
      "live-merchant-ourplace-beechwood-spoons",
      "live-merchant-ourplace-walnut-knife-block",
    ],
    listings: [
      {
        productId: "live-merchant-ourplace-utensil-essentials",
        price: {
          amount: 9900,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.8,
        ratingCount: "653",
        image:
          "/api/reference-media/merchant-ourplace-catalog-9d52fe768eda85b7e723",
      },
      {
        productId: "live-merchant-ourplace-knife-trio-bundle",
        price: {
          amount: 14495,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.8,
        ratingCount: "560",
        image:
          "/api/reference-media/merchant-ourplace-catalog-fdfbcc814117c52623c4",
      },
      {
        productId: "live-merchant-ourplace-home-cook-apron",
        price: {
          amount: 4900,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.7,
        ratingCount: "84",
        image:
          "/api/reference-media/merchant-ourplace-catalog-691027edd7557d99b4bf",
      },
      {
        productId: "live-merchant-ourplace-hot-mitts",
        price: {
          amount: 4500,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.8,
        ratingCount: "273",
        image:
          "/api/reference-media/merchant-ourplace-catalog-8bf81ef36efd0263be1e",
      },
      {
        productId: "live-merchant-ourplace-double-dish-towels",
        price: {
          amount: 3500,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.8,
        ratingCount: "161",
        image:
          "/api/reference-media/merchant-ourplace-catalog-48505a763003c81aff68",
      },
      {
        productId: "live-merchant-ourplace-loop-napkins",
        price: {
          amount: 4000,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.8,
        ratingCount: "47",
        image:
          "/api/reference-media/merchant-ourplace-catalog-19b48744ff32b3c47745",
      },
      {
        productId: "live-merchant-ourplace-hosting-apron",
        price: {
          amount: 5000,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.1,
        ratingCount: "21",
        image:
          "/api/reference-media/merchant-ourplace-catalog-bb2b2b745d9b00e8c8a2",
      },
      {
        productId: "live-merchant-ourplace-shear-genius",
        price: {
          amount: 2199,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.8,
        ratingCount: "476",
        image:
          "/api/reference-media/merchant-ourplace-catalog-d35ef336bcb6e2d4d677",
      },
      {
        productId: "live-merchant-ourplace-chefs-knife",
        price: {
          amount: 7500,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.7,
        ratingCount: "391",
        image:
          "/api/reference-media/merchant-ourplace-catalog-8fa79da3a85a8002ee42",
      },
      {
        productId: "live-merchant-ourplace-paring-knife",
        price: {
          amount: 2499,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.8,
        ratingCount: "306",
        image:
          "/api/reference-media/merchant-ourplace-catalog-f33f2e5e693a5a95b665",
      },
      {
        productId: "live-merchant-ourplace-serrated-knife",
        price: {
          amount: 4599,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.7,
        ratingCount: "210",
        image:
          "/api/reference-media/merchant-ourplace-catalog-524a30a96fa1e3708bce",
      },
      {
        productId: "live-merchant-ourplace-beechwood-spatulas",
        price: {
          amount: 1199,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.6,
        ratingCount: "1K",
        image:
          "/api/reference-media/merchant-ourplace-catalog-a9c3f10290b1e255b55b",
      },
      {
        productId: "live-merchant-ourplace-beechwood-spoons",
        price: {
          amount: 1199,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.8,
        ratingCount: "346",
        image:
          "/api/reference-media/merchant-ourplace-catalog-62c96e33bd83e8fc433c",
      },
      {
        productId: "live-merchant-ourplace-walnut-knife-block",
        price: {
          amount: 9900,
          currency: "USD",
        },
        compareAt: null,
        rating: 4.6,
        ratingCount: "61",
        image:
          "/api/reference-media/merchant-ourplace-catalog-cf11788eed60a47c07b1",
      },
    ],
    showSaleFilter: true,
    defaultInStockOnly: true,
    inStockProductIds: [
      "live-merchant-ourplace-utensil-essentials",
      "live-merchant-ourplace-knife-trio-bundle",
      "live-merchant-ourplace-home-cook-apron",
      "live-merchant-ourplace-hot-mitts",
      "live-merchant-ourplace-double-dish-towels",
      "live-merchant-ourplace-loop-napkins",
      "live-merchant-ourplace-hosting-apron",
      "live-merchant-ourplace-shear-genius",
      "live-merchant-ourplace-chefs-knife",
      "live-merchant-ourplace-paring-knife",
      "live-merchant-ourplace-serrated-knife",
      "live-merchant-ourplace-beechwood-spatulas",
      "live-merchant-ourplace-beechwood-spoons",
      "live-merchant-ourplace-walnut-knife-block",
    ],
  },
};
