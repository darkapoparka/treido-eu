import { beforeEach, expect, it, vi } from "vitest";
import { readDiscoveryInput } from "../catalog/discovery-input";
import { explorePageMetadata } from "../catalog/public-metadata";
import type { BuyerEntryData } from "../catalog/buyer-entry-model";

const boundary = vi.hoisted(() => ({
  data: vi.fn(),
  metadata: vi.fn(),
  request: new Map<unknown, Map<string, unknown>>(),
}));
vi.mock("../catalog/buyer-entry.server", () => ({
  readBuyerExploreData: boundary.data,
}));
vi.mock("../catalog/public-metadata.server", () => ({
  readExploreMetadata: boundary.metadata,
}));
// Direct route calls have no RSC renderer. Model its request-scoped cache here,
// resetting it between requests, while retaining all other React behavior.
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  cache: (read: (criteria: string) => unknown) => (criteria: string) => {
    let entries = boundary.request.get(read);
    if (!entries) {
      entries = new Map();
      boundary.request.set(read, entries);
    }
    if (!entries.has(criteria)) entries.set(criteria, read(criteria));
    return entries.get(criteria);
  },
}));
vi.mock("./explore", () => ({ Explore: "shop-explore" }));
vi.mock("../locale/request.server", () => ({
  readLocaleRequest: async () => ({ locale: "bg" }),
}));
vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    throw new Error(`REDIRECT:${href}`);
  },
}));
import Page, { generateMetadata } from "../../app/explore/page";

beforeEach(() => {
  vi.clearAllMocks();
  boundary.request.clear();
  boundary.metadata.mockImplementation((source, available) =>
    explorePageMetadata(
      { locale: "bg", origin: "https://treido.example", indexable: true },
      source,
      available,
    ),
  );
});

function publicData(available: boolean): BuyerEntryData {
  const input = readDiscoveryInput({ lang: "bg" }).input;
  return {
    publicView: {
      input,
      ...(available
        ? {
            page: {
              input,
              items: [],
              total: 0,
              facets: { categories: [], conditions: [], sellers: [] },
              nextCursor: null,
              cursorReset: false,
            },
          }
        : { unavailable: true }),
    },
  };
}

it.each([
  { catalog: { products: [], stores: [] } },
  { publicView: { input: { locale: "bg" }, unavailable: true } },
])(
  "uses the same actual Explore owner for reference/public data (%j)",
  async (data) => {
    boundary.data.mockResolvedValue(data);
    const source = { lang: "bg", seller: "business", condition: "good" };
    const page = await Page({ searchParams: Promise.resolve(source) });
    expect(page.type).toBe("shop-explore");
    expect(page.props).toEqual(data);
    expect(boundary.data).toHaveBeenCalledExactlyOnceWith(
      "seller=business&condition=good",
    );
  },
);

it.each([true, false])(
  "metadata and body share the current qualified root availability (%s)",
  async (available) => {
    const data = publicData(available);
    boundary.data.mockResolvedValue(data);
    const props = { searchParams: Promise.resolve({ lang: "bg" }) };
    const [metadata, page] = await Promise.all([
      generateMetadata(props),
      Page(props),
    ]);
    expect(page.type).toBe("shop-explore");
    expect(page.props).toEqual(data);
    expect(boundary.data).toHaveBeenCalledExactlyOnceWith("");
    expect(boundary.metadata).toHaveBeenCalledExactlyOnceWith(
      { lang: "bg" },
      available,
    );
    expect(metadata.robots).toEqual({ index: available, follow: available });
    expect(metadata.alternates?.canonical).toBe(
      available ? "https://treido.example/explore?lang=bg" : undefined,
    );
  },
);

it("shares one normalized public read without admitting private URL variants to indexing", async () => {
  const data = publicData(true);
  boundary.data.mockResolvedValue(data);
  const metadataSource = {
    q: "  phone  ",
    seller: "business",
    minPrice: "10",
    lang: "en",
    sellerId: "private-operating-seller",
    unknown: "ignored",
  };
  const [metadata, page] = await Promise.all([
    generateMetadata({ searchParams: Promise.resolve(metadataSource) }),
    Page({
      searchParams: Promise.resolve({
        lang: "en",
        minPrice: "10.00",
        seller: "business",
        q: "phone",
        collectionId: "private-collection",
      }),
    }),
  ]);
  expect(page.props).toEqual(data);
  expect(boundary.data).toHaveBeenCalledExactlyOnceWith(
    "q=phone&seller=business&minPrice=10.00&currency=EUR&lang=en",
  );
  expect(boundary.metadata).toHaveBeenCalledExactlyOnceWith(
    metadataSource,
    true,
  );
  expect(metadata.robots).toEqual({ index: false, follow: false });
  expect(metadata.alternates).toBeUndefined();
});

it("rechecks availability for the next request rather than retaining an indexable snapshot", async () => {
  const props = { searchParams: Promise.resolve({ lang: "bg" }) };
  boundary.data.mockResolvedValue(publicData(true));
  expect((await generateMetadata(props)).robots).toEqual({
    index: true,
    follow: true,
  });
  boundary.request.clear();
  const unavailable = publicData(false);
  boundary.data.mockResolvedValue(unavailable);
  const [metadata, page] = await Promise.all([
    generateMetadata(props),
    Page(props),
  ]);
  expect(boundary.data).toHaveBeenCalledTimes(2);
  expect(page.props).toEqual(unavailable);
  expect(metadata.robots).toEqual({ index: false, follow: false });
  expect(metadata.alternates).toBeUndefined();
});

it("reference catalogue metadata remains non-indexable despite a rendered Explore body", async () => {
  const data = { catalog: { products: [], stores: [] } };
  boundary.data.mockResolvedValue(data);
  const props = { searchParams: Promise.resolve({ lang: "bg" }) };
  const [metadata, page] = await Promise.all([
    generateMetadata(props),
    Page(props),
  ]);
  expect(page.props).toEqual(data);
  expect(boundary.data).toHaveBeenCalledExactlyOnceWith("");
  expect(boundary.metadata).toHaveBeenCalledExactlyOnceWith(
    { lang: "bg" },
    false,
  );
  expect(metadata.robots).toEqual({ index: false, follow: false });
  expect(metadata.alternates).toBeUndefined();
});

it("query category entry canonicalizes to the same category results route without loading previews", async () => {
  const source = {
    category: "nav:electronics/mobile",
    seller: "personal",
    condition: "good",
    lang: "bg",
  };
  const metadata = await generateMetadata({
    searchParams: Promise.resolve(source),
  });
  expect(metadata.robots).toEqual({ index: false, follow: false });
  expect(metadata.alternates).toBeUndefined();
  expect(boundary.metadata).toHaveBeenCalledExactlyOnceWith(source, false);
  await expect(
    Page({
      searchParams: Promise.resolve(source),
    }),
  ).rejects.toThrow(
    "REDIRECT:/explore/nav%3Aelectronics%2Fmobile?category=nav%3Aelectronics%2Fmobile&seller=personal&condition=good&lang=bg",
  );
  expect(boundary.data).not.toHaveBeenCalled();
});
