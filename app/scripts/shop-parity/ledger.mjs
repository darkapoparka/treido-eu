import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { flowRecipes } from "./recipes.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "references/shop/manifest.json"), "utf8"),
);
const run = process.argv[2];
if (!run || !/^[a-zA-Z0-9_-]+$/.test(run))
  throw new Error("Provide a local parity run name.");
const report = JSON.parse(
  fs.readFileSync(
    path.join(root, ".qa/shop-parity/runs", run, "report.json"),
    "utf8",
  ),
);
const scores = new Map(report.rows.map((row) => [row.id, row]));
const total = manifest.flows.reduce((n, flow) => n + flow.screens.length, 0);
const mapped = manifest.flows.reduce(
  (n, flow, i) =>
    n + flow.screens.filter((_, j) => flowRecipes[i + 1]?.frames[j]).length,
  0,
);
const scored = report.rows.filter(
  (row) => row.status === "scored" && !row.browserErrors?.length,
);
const candidates = scored.filter(
  (row) => row.maePct <= 1.5 && row.badPixelPct <= 8,
);
const text = [
  "# Shop frame execution ledger",
  "",
  "Generated from the frozen manifest and deterministic replay definitions. This is a frame index, not a second work queue. `shop-parity-checklist.md` owns flow acceptance.",
  "",
  `**Corpus:** ${manifest.flows.length} flows / ${total} ordered frames. **Mapped:** ${mapped}/${total}. **Scored in this run:** ${scored.length}/${total}. **Numerical candidates:** ${candidates.length}; not automatic visual acceptance.`,
  "",
  `Evidence run: \`${run}\`; created ${report.createdAt}; source HEAD \`${report.gitHead}\` (the report records the working-tree state). Viewport: 393x793.`,
  "",
  "A numerical candidate requires MAE <= 1.5% and bad-pixel-12 <= 8%. Direct region inspection, complete UX coverage, sibling regression checks and owner acceptance are still required. Unchecked entries are not complete.",
  "",
];
for (const [i, flow] of manifest.flows.entries()) {
  const flowNo = String(i + 1).padStart(3, "0");
  text.push(`## SF-${flowNo} — ${flow.title}`, "");
  text.push(
    "| Frame | Source | State | Replay | MAE % | Bad pixels % | Status |",
    "| --- | --- | --- | --- | ---: | ---: | --- |",
  );
  for (const [j, screen] of flow.screens.entries()) {
    const frameNo = String(j + 1).padStart(3, "0");
    const id = `f${flowNo}-${frameNo}`;
    const recipe = flowRecipes[i + 1]?.frames[j];
    const row = scores.get(id);
    const valid = row?.status === "scored" && !row.browserErrors?.length;
    const candidate = valid && row.maePct <= 1.5 && row.badPixelPct <= 8;
    const state = (recipe?.state ?? "unmapped").replaceAll("|", "/");
    const status = !recipe
      ? "OPEN"
      : !row
        ? "NOT SCORED"
        : !valid
          ? "REPLAY FAILED"
          : candidate
            ? "NUMERICAL CANDIDATE"
            : "REFINE";
    text.push(
      `| [ ] SF-${flowNo}:${frameNo} | \`${screen.file}\` | ${state} | ${recipe ? "Defined" : "Missing"} | ${valid ? row.maePct.toFixed(3) : "—"} | ${valid ? row.badPixelPct.toFixed(3) : "—"} | ${status} |`,
    );
  }
  text.push("");
}
fs.writeFileSync(path.join(root, "shop-frame-ledger.md"), text.join("\n"));
console.log(
  `Wrote ${total} frames; ${mapped} mapped; ${scored.length} scored; ${candidates.length} numerical candidates. No acceptance was granted.`,
);
