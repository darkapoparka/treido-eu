import { categoryLeaves } from "./registry";
import type { CategoryId, CategoryLabels, CategoryLeaf } from "./types";

/** Browse groups do not change the identity or approval of publication leaves. */
export const BROWSE_TAXONOMY_VERSION = 1 as const;
const departments = [
  [
    "electronics",
    "Електроника",
    "Electronics",
    [
      [
        "mobile",
        "Телефони и таблети",
        "Phones and tablets",
        "phones tablets smartwatches-wearables phone-accessories",
      ],
      [
        "computers",
        "Компютри",
        "Computers",
        "laptops desktop-computers computer-components monitors computer-accessories",
      ],
      [
        "audio-video",
        "Аудио и видео",
        "Audio and video",
        "televisions-projectors headphones speakers-audio cameras-lenses smart-home-networking",
      ],
    ],
  ],
  [
    "fashion",
    "Мода",
    "Fashion",
    [
      [
        "clothing",
        "Облекло",
        "Clothing",
        "tops-shirts trousers-jeans dresses skirts knitwear jackets-coats suits-occasionwear sportswear unworn-intimates-swimwear",
      ],
      [
        "accessories",
        "Обувки и аксесоари",
        "Shoes and accessories",
        "shoes bags watches jewellery accessories",
      ],
    ],
  ],
  [
    "home",
    "Дом",
    "Home",
    [
      [
        "furniture",
        "Мебели",
        "Furniture",
        "living-room-furniture bedroom-furniture tables-chairs storage-shelving bathroom-storage",
      ],
      [
        "decor",
        "Декорация и текстил",
        "Decor and textiles",
        "lighting rugs-curtains bedding-textiles decor",
      ],
      [
        "kitchen",
        "Кухня и организация",
        "Kitchen and storage",
        "cookware tableware household-organisation",
      ],
    ],
  ],
  [
    "appliances",
    "Уреди",
    "Appliances",
    [
      [
        "large",
        "Големи уреди",
        "Large appliances",
        "washing-drying refrigeration ovens-hobs dishwashers",
      ],
      [
        "small",
        "Малки уреди",
        "Small appliances",
        "small-kitchen-appliances coffee-machines cleaning-appliances heating-cooling sewing-machines",
      ],
    ],
  ],
  [
    "garden",
    "Градина",
    "Garden",
    [
      [
        "garden",
        "За градината",
        "Garden",
        "garden-tools garden-furniture barbecues-outdoor-living pots-planters",
      ],
    ],
  ],
  [
    "garden-diy",
    "Инструменти и ремонт",
    "Tools and DIY",
    [
      [
        "tools",
        "Инструменти",
        "Tools",
        "hand-tools power-tools tool-accessories",
      ],
      [
        "renovation",
        "Ремонт",
        "Renovation",
        "building-materials plumbing-fittings electrical-fittings workwear-safety-equipment",
      ],
    ],
  ],
  [
    "sports-outdoors",
    "Спорт и туризъм",
    "Sports and outdoors",
    [
      [
        "sports",
        "Спорт",
        "Sports",
        "fitness-equipment team-sports racket-sports water-sports winter-sports",
      ],
      [
        "cycling",
        "Велосипеди и тротинетки",
        "Bikes and scooters",
        "bicycles cycling-parts skating-scooters",
      ],
      [
        "outdoors",
        "Туризъм и риболов",
        "Camping and fishing",
        "camping-hiking fishing-equipment outdoor-clothing",
      ],
    ],
  ],
  [
    "baby-kids",
    "Бебе и дете",
    "Baby and kids",
    [
      [
        "clothing",
        "Детско облекло",
        "Children's clothing",
        "baby-clothing kids-clothing kids-shoes",
      ],
      [
        "baby",
        "За бебето",
        "Baby equipment",
        "strollers nursery-furniture feeding-accessories baby-carriers",
      ],
      ["play", "Играчки и училище", "Toys and school", "toys school-supplies"],
    ],
  ],
  [
    "beauty-care",
    "Красота",
    "Beauty",
    [
      [
        "cosmetics",
        "Козметика",
        "Cosmetics",
        "sealed-skincare sealed-makeup sealed-fragrance sealed-bath-body",
      ],
      [
        "tools",
        "Уреди и аксесоари",
        "Tools and appliances",
        "hair-styling-appliances grooming-appliances beauty-tools",
      ],
    ],
  ],
  [
    "books-media",
    "Книги и медии",
    "Books and media",
    [
      [
        "books",
        "Книги",
        "Books",
        "fiction non-fiction textbooks children-books comics-manga magazines",
      ],
      [
        "media",
        "Музика и филми",
        "Music and films",
        "vinyl-cds films-disc-media",
      ],
    ],
  ],
  [
    "hobbies-collectibles",
    "Хоби и колекции",
    "Hobbies and collectibles",
    [
      [
        "collectibles",
        "Колекционерство",
        "Collectibles",
        "trading-cards stamps-coins collectible-figures antiques",
      ],
      [
        "craft",
        "Творчески материали",
        "Craft supplies",
        "craft-supplies sewing-knitting photography-accessories",
      ],
      [
        "games",
        "Игри и модели",
        "Games and models",
        "board-games models-miniatures radio-controlled-hobby",
      ],
    ],
  ],
  [
    "music",
    "Музика",
    "Music",
    [
      [
        "instruments",
        "Инструменти",
        "Instruments",
        "guitars-basses keyboards-pianos drums-percussion wind-instruments string-instruments",
      ],
      [
        "equipment",
        "Студио и аксесоари",
        "Studio and accessories",
        "studio-recording dj-equipment amplifiers-effects instrument-accessories",
      ],
    ],
  ],
  [
    "gaming",
    "Гейминг",
    "Gaming",
    [
      [
        "gaming",
        "Гейминг",
        "Gaming",
        "consoles physical-games controllers gaming-peripherals vr-equipment gaming-furniture console-accessories",
      ],
    ],
  ],
  [
    "motors-parts",
    "Авточасти",
    "Auto parts",
    [
      [
        "parts",
        "Части и гуми",
        "Parts and tyres",
        "car-parts motorcycle-parts tyres-wheels",
      ],
      [
        "accessories",
        "Аксесоари",
        "Accessories",
        "car-electronics interior-accessories roof-racks-carriers motorcycle-accessories",
      ],
      [
        "garage",
        "Гараж и поддръжка",
        "Garage and maintenance",
        "garage-equipment car-care-tools",
      ],
    ],
  ],
  [
    "pet-supplies",
    "Домашни любимци",
    "Pets",
    [
      [
        "care",
        "Грижа и принадлежности",
        "Care and accessories",
        "beds-furniture carriers-travel leads-collars toys grooming-tools",
      ],
      [
        "habitats",
        "Аквариуми и клетки",
        "Aquariums and cages",
        "aquarium-equipment bird-small-pet-equipment",
      ],
    ],
  ],
  [
    "business-equipment",
    "Бизнес оборудване",
    "Business equipment",
    [
      [
        "office",
        "Офис",
        "Office",
        "office-furniture printers-scanners office-supplies",
      ],
      [
        "professional",
        "Професионално оборудване",
        "Professional equipment",
        "retail-equipment hospitality-equipment packaging workshop-equipment professional-tools",
      ],
    ],
  ],
  [
    "art-handmade",
    "Изкуство и занаяти",
    "Art and handmade",
    [
      ["art", "Изкуство", "Art", "original-art prints-posters ceramics"],
      [
        "handmade",
        "Ръчна изработка",
        "Handmade",
        "handmade-home handmade-accessories stationery-gifts seasonal-decor",
      ],
    ],
  ],
] as const;

export type BrowseCategoryId = CategoryId | "cat:garden" | `nav:${string}`;
type BrowseParent = Readonly<{
  id: BrowseCategoryId;
  kind: "root" | "group";
  parentId: BrowseCategoryId | null;
  labels: CategoryLabels;
}>;
export type BrowseCategory =
  | BrowseParent
  | (Omit<CategoryLeaf, "parentId"> & {
      parentId: BrowseCategoryId;
    });

const nodes: BrowseCategory[] = [];
const assigned = new Set<string>();
for (const [slug, bg, en, groups] of departments) {
  const rootId = `cat:${slug}` as BrowseCategoryId;
  nodes.push({ id: rootId, kind: "root", parentId: null, labels: { bg, en } });
  for (const [group, groupBg, groupEn, leafSlugs] of groups) {
    // A single group adds no useful choice; its leaves sit directly below the root.
    const parentId =
      groups.length === 1 ? rootId : (`nav:${slug}/${group}` as const);
    if (groups.length > 1)
      nodes.push({
        id: parentId,
        kind: "group",
        parentId: rootId,
        labels: { bg: groupBg, en: groupEn },
      });
    for (const leafSlug of leafSlugs.split(" ")) {
      const sourceRoot = slug === "garden" ? "garden-diy" : slug;
      const leaf = categoryLeaves.find(
        (item) => item.id === `cat:${sourceRoot}/${leafSlug}`,
      );
      if (!leaf || assigned.has(leaf.id))
        throw new Error(`Invalid browse leaf: ${sourceRoot}/${leafSlug}`);
      assigned.add(leaf.id);
      nodes.push({ ...leaf, parentId });
    }
  }
}
if (assigned.size !== categoryLeaves.length)
  throw new Error("Incomplete browse taxonomy");
export const browseCategories: readonly BrowseCategory[] = Object.freeze(
  nodes.map((node) => Object.freeze(node)),
);
export const browseCategoryRoots = Object.freeze(
  browseCategories.filter((node) => node.kind === "root"),
);
const byId = new Map(browseCategories.map((node) => [node.id, node]));
export function getBrowseCategory(id: string) {
  return byId.get(id as BrowseCategoryId);
}
export function getBrowseChildren(id: string): readonly BrowseCategory[] {
  return browseCategories.filter((node) => node.parentId === id);
}
export function getBrowseAncestry(id: string): readonly BrowseCategory[] {
  const path: BrowseCategory[] = [];
  let node = getBrowseCategory(id);
  while (node) {
    path.unshift(node);
    node = node.parentId ? getBrowseCategory(node.parentId) : undefined;
  }
  return path;
}
export function getBrowseLeafIds(id: string): readonly CategoryLeaf["id"][] {
  const node = getBrowseCategory(id);
  if (!node) return [];
  if (node.kind === "leaf") return [node.id];
  return getBrowseChildren(id).flatMap((child) => getBrowseLeafIds(child.id));
}
