import { blankProduct, parseMoney, type Product } from "./model";
export function parseProductCsv(input: string): {
  products: Product[];
  errors: string[];
} {
  if (input.length > 250_000)
    return { products: [], errors: ["Use a CSV smaller than 250 KB."] };
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (c === '"') {
      if (quoted && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === "," || c === "\n")) {
      row.push(cell.trim());
      cell = "";
      if (c === "\n") {
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else if (c !== "\r") cell += c;
  }
  if (quoted)
    return {
      products: [],
      errors: ["An opening quote is missing its closing quote."],
    };
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length > 501)
    return { products: [], errors: ["Import up to 500 products at a time."] };
  const headers = (rows.shift() ?? []).map((value) =>
    value.replace(/^\uFEFF/, "").toLowerCase(),
  );
  if (!headers.includes("title") || !headers.includes("price"))
    return {
      products: [],
      errors: [
        "The CSV needs Title and Price columns. Optional columns: SKU, Quantity, Status, Category.",
      ],
    };
  const products: Product[] = [],
    errors: string[] = [];
  rows.forEach((values, i) => {
    const read = (key: string) => values[headers.indexOf(key)] ?? "";
    const title = read("title");
    const price = parseMoney(read("price"));
    const quantity = read("quantity") || "0";
    if (
      !title ||
      title.length > 160 ||
      price === null ||
      !/^\d{1,6}$/.test(quantity)
    ) {
      errors.push(
        `Row ${i + 2}: enter a title, a positive price and a whole stock quantity.`,
      );
      return;
    }
    const status = read("status");
    if (status && !["Active", "Draft", "Archived"].includes(status)) {
      errors.push(`Row ${i + 2}: status must be Active, Draft or Archived.`);
      return;
    }
    products.push({
      ...blankProduct(`import-${i + 1}`),
      title,
      price,
      quantity: Number(quantity),
      sku: read("sku").slice(0, 80),
      category: read("category").slice(0, 100),
      status: status ? (status as Product["status"]) : "Draft",
    });
  });
  if (!rows.length) errors.push("Add at least one product row.");
  return { products, errors };
}
