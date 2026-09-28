import { notFound } from "next/navigation";
import { readCatalog } from "@/features/catalog/queries.server";
import { Explore } from "@/features/discovery/explore";

export default async function Page({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  // This installed router retains URI escapes in dynamic segment values.
  // Decode once at the route boundary, before rendering or building Search.
  let category: string;
  try {
    category = decodeURIComponent((await params).category);
  } catch {
    notFound();
  }
  const catalog = await readCatalog();
  return <Explore catalog={catalog} category={category} />;
}
