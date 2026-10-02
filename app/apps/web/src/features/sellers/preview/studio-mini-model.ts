import { blankProduct, type Product, type StoreState } from "./model";

export type MiniAnswer =
  | { kind: "draft"; title: string; description: string }
  | {
      kind: "review";
      products: { id: string; title: string; missing: string[] }[];
    }
  | { kind: "catalog"; query: string; products: Product[] }
  | { kind: "unavailable" };

/** A finite local tool, never a model response or a merchant authority boundary. */
export function runStudioMini(
  input: string,
  store: Pick<StoreState, "products">,
): MiniAnswer {
  const prompt = input
    .trim()
    .slice(0, 500)
    .replace(/^(?:help me(?: to)?|помогни ми(?: да)?)\s+/iu, "");
  if (!prompt) return { kind: "unavailable" };
  if (/^(review|check|прегледай|провери)(?:\s|$)/iu.test(prompt))
    return {
      kind: "review",
      products: store.products.slice(0, 20).map((p) => ({
        id: p.id,
        title: p.title,
        missing: [
          ...(!p.title.trim() ? ["title"] : []),
          ...(!p.description.trim() ? ["description"] : []),
          ...(!p.image ? ["photo"] : []),
          ...(p.price <= 0 ? ["price"] : []),
        ],
      })),
    };
  const draft =
    /^(?:create|add|draft|създай|създам|добави|добавя)(?:\s|$)/iu.exec(prompt);
  if (draft) {
    const title = prompt
      .slice(draft[0].length)
      .replace(
        /^(?:(?:a|new|product|listing|for|нов|нова|продукт|обява|за)(?:\s+|$))+/iu,
        "",
      )
      .replace(/^[\s:]+/, "")
      .slice(0, 160);
    return { kind: "draft", title, description: "" };
  }
  const explicit = /^(?:find|search|търси|намери)(?:\s|$)/iu.test(prompt);
  const query = prompt
    .replace(/^(?:find|search|търси|намери)\s+(?:for\s+)?/iu, "")
    .slice(0, 160);
  const words = query.normalize("NFKC").toLocaleLowerCase().split(/\s+/);
  const products = store.products
    .filter((p) => {
      const haystack = `${p.title} ${p.sku} ${p.category} ${p.tags}`
        .normalize("NFKC")
        .toLocaleLowerCase();
      return words.every((word) => haystack.includes(word));
    })
    .slice(0, 8);
  return explicit || products.length
    ? { kind: "catalog", query, products }
    : { kind: "unavailable" };
}

/** Only seller-entered facts are copied; price, condition and stock stay unconfirmed. */
export function miniDraft(
  title: string,
  description: string,
  id: string,
): Product | null {
  const name = title.trim();
  if (
    !name ||
    name.length > 160 ||
    description.length > 5000 ||
    id.length > 80 ||
    !/^product-[a-z0-9-]+$/i.test(id)
  )
    return null;
  return {
    ...blankProduct(id),
    title: name,
    description: description.trim(),
    condition: "",
    status: "Draft",
  };
}

export function readMiniRecents(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? value
          .filter(
            (p): p is string =>
              typeof p === "string" && p.trim().length > 0 && p.length <= 500,
          )
          .slice(0, 8)
      : [];
  } catch {
    return [];
  }
}
