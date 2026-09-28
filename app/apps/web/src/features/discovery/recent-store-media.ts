const recentCover: Record<string, string> = {
  kitsch: "recent-kitsch-cover",
  pura: "recent-pura-cover",
  drmtlgy: "recent-drmtlgy-photo",
  "loaded-tea": "recent-loaded-logo",
};

export function recentStoreCover(
  storeId: string,
  surface: "search" | "home" | "profile",
) {
  if (surface === "profile")
    return storeId === "kitsch" ? "profile-recent-kitsch-cover" : undefined;
  if (surface === "home" && storeId === "drmtlgy")
    return "home-recent-drmtlgy-cover";
  return recentCover[storeId];
}
