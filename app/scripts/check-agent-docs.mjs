import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const text = (p) => fs.readFileSync(path.join(root, p), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const tracked = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: root, encoding: "utf8" },
);
const files = [...new Set(tracked.split("\0").filter(Boolean))];
const requiredDocs = [
  "AGENTS.md",
  "product.md",
  "web.md",
  "native.md",
  "app.md",
  "admin.md",
  "ai.md",
  "design.md",
  "style-guide.md",
  "architecture.md",
  "verification.md",
  "techstack.md",
  "tasks.md",
  "docs/README.md",
  "docs/STATUS.md",
  "docs/agents/codex.md",
  "docs/agents/skills.md",
];
for (const file of requiredDocs) {
  assert(files.includes(file), `Missing current documentation owner: ${file}`);
  assert(text(file).trim().length > 0, `Empty documentation owner: ${file}`);
}
const retiredGuides = [
  "parallel-execution.md",
  "parallel-prompts.md",
  "docs/parity/lane-a-account.md",
  "docs/parity/lane-b-commerce.md",
  "docs/parity/lane-c-discovery.md",
];
for (const file of retiredGuides) {
  assert(
    !files.includes(file) && !fs.existsSync(path.join(root, file)),
    `Retired active guide reintroduced: ${file}; use docs/README.md retirement rules`,
  );
}
const upstream = JSON.parse(text("docs/agents/upstream-skills.lock.json"));
const isVendor = (p) =>
  upstream.skills.some((name) => p.startsWith(`.agents/skills/${name}/`));
const markdown = files.filter(
  (p) =>
    p.endsWith(".md") &&
    !isVendor(p) &&
    !p.startsWith("docs/history/pre-astra-"),
);
let links = 0;
for (const file of markdown) {
  const content = text(file);
  for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^(?:[a-z]+:|#|\/)/i.test(target)) continue;
    const name = target.split("#")[0];
    if (!name || /[<>]/.test(name)) continue;
    const resolved = path.resolve(
      root,
      path.dirname(file),
      decodeURIComponent(name),
    );
    assert(
      fs.existsSync(resolved),
      `Broken documentation link: ${file} -> ${target}`,
    );
    links += 1;
  }
}
const skillFiles = files.filter((p) =>
  /^\.agents\/skills\/[^/]+\/SKILL\.md$/.test(p),
);
const names = new Set();
for (const file of skillFiles) {
  const content = text(file);
  const front = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert(front, `Missing skill frontmatter: ${file}`);
  const name = front[1]
    .match(/^name:\s*(.+)$/m)?.[1]
    .replace(/^["']|["']$/g, "")
    .trim();
  const description = front[1].match(/^description:\s*(.+)$/m)?.[1].trim();
  assert(name && /^[a-z0-9-]+$/.test(name), `Invalid skill name: ${file}`);
  assert(
    description && description.length > 10,
    `Missing skill description: ${file}`,
  );
  assert(!names.has(name), `Duplicate repo skill name: ${name}`);
  names.add(name);
}
const projectSkills = [
  "treido-shop-parity",
  "treido-food-commerce",
  "treido-merchant-cms",
  "treido-ai-quality",
  "treido-session",
];
const expectedSkills = new Set([...upstream.skills, ...projectSkills]);
assert(
  names.size === expectedSkills.size,
  "Review expected selected skill inventory",
);
for (const name of expectedSkills) {
  assert(names.has(name), `Missing selected repository skill: ${name}`);
}
assert(
  Buffer.byteLength(text("AGENTS.md")) <= 8192,
  "Root AGENTS exceeded the project routing budget; extract task-specific detail",
);
assert(
  text("AGENTS.md").includes("canonical branch **main**") &&
    text("AGENTS.md").includes("`astra-pro`"),
  "Missing canonical main / optional astra-pro branch contract",
);
for (let task = 1; task <= 14; task += 1) {
  assert(
    new RegExp(`^## Task ${task} - `, "m").test(text("tasks.md")),
    `Missing stable Task ${task}`,
  );
}
const history = "docs/history/pre-astra-2026-09-12/";
const archive = JSON.parse(text(history + "manifest.json"));
for (const [name, expected] of Object.entries(archive.files)) {
  const bytes = fs.readFileSync(path.join(root, history, name + ".txt"));
  assert(
    crypto.createHash("sha256").update(bytes).digest("hex") === expected,
    `Historical snapshot changed: ${name}`,
  );
}
const ids = (content) =>
  new Set(
    content.match(/\b(?:BUY|ACC|MER|COM|ADM|OPS|NAT|QUA)-\d{3}\b/g) || [],
  );
const oldIds = ids(text(history + "product.md.txt"));
const currentIds = ids(
  text("product.md") + text("docs/product/requirements.md"),
);
for (const id of oldIds)
  assert(currentIds.has(id), `Lost product requirement ID: ${id}`);
const shopify = JSON.parse(text("shopify/manifest.json"));
assert(
  shopify.source.version_id === "42a81476-425f-5572-a7bb-bd3b0134c8ec",
  "Shopify source version changed without review",
);
if (shopify.status === "not-acquired")
  assert(shopify.assets.length === 0, "Unreconciled Shopify acquisition state");
console.log(
  `Docs checked: ${markdown.length} Markdown files, ${links} relative links, ${names.size} unique skills, 14 stable tasks, ${oldIds.size} retained requirement IDs, ${Object.keys(archive.files).length} intact historical snapshots.`,
);
console.log(
  `Current setup: ${requiredDocs.length} documentation owners present; ${retiredGuides.length} retired active guides absent; selected skill names verified.`,
);
console.log(
  "Structural/integrity checks only; not client skill discovery, MCP connectivity, UI, service, source-acceptance or release proof.",
);
