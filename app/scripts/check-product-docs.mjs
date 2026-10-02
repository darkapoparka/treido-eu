import { readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL, URL } from "node:url";
import { Buffer } from "node:buffer";
import process from "node:process";
import console from "node:console";

// Offline, read-only validation. Donor archives and external URLs are not crawled.
export function stripFences(markdown) {
  let fence = null;
  return markdown
    .split(/\r?\n/)
    .map((line) => {
      const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
      if (marker) {
        if (!fence) fence = marker[1];
        else if (marker[1][0] === fence[0] && marker[1].length >= fence.length)
          fence = null;
        return "";
      }
      return fence ? "" : line;
    })
    .join("\n");
}

export function linksIn(markdown) {
  const clean = stripFences(markdown);
  const inline = [
    ...clean.matchAll(
      /!?\[[^\]]*\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+["'][^"']*["'])?\s*\)/g,
    ),
  ];
  const definitions = [
    ...clean.matchAll(/^\s{0,3}\[[^\]]+\]:\s*(<[^>]+>|\S+)/gm),
  ];
  return [...inline, ...definitions].map((match) =>
    match[1].replace(/^<|>$/g, ""),
  );
}

export function headingAnchors(markdown) {
  const counts = new Map();
  const anchors = new Set();
  for (const match of stripFences(markdown).matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const slug = match[1]
      .replace(/\s+#+\s*$/, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, "")
      .trim()
      .toLowerCase()
      .replace(/\s/g, "-");
    const count = counts.get(slug) ?? 0;
    counts.set(slug, count + 1);
    anchors.add(count ? `${slug}-${count}` : slug);
  }
  for (const match of stripFences(markdown).matchAll(
    /<(?:a|span)\b[^>]*\b(?:id|name)=["']([^"']+)["'][^>]*>/g,
  ))
    anchors.add(match[1]);
  return anchors;
}

export function inside(root, target) {
  const relative = path.relative(root, target);
  return (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

export function localTarget(root, source, href) {
  if (/^(?:file:|[a-z]:[\\/])/i.test(href))
    throw new Error("Machine-local file link");
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) return null;
  const [location, ...fragment] = href.split("#");
  const decoded = decodeURIComponent(location.split("?")[0]).replaceAll(
    "\\",
    "/",
  );
  if (path.isAbsolute(decoded) || /^[a-z]:/i.test(decoded))
    throw new Error("Absolute file link");
  const target = decoded
    ? path.resolve(root, path.dirname(source), decoded)
    : path.resolve(root, source);
  if (!inside(root, target)) throw new Error("Link escapes repository");
  return { target, anchor: decodeURIComponent(fragment.join("#")) };
}

export function taskRows(markdown) {
  const section =
    markdown.split("## Executable work packages")[1]?.split(/^## /m)[0] ?? "";
  return section
    .split(/\r?\n/)
    .filter((line) => /^\|\s*T\d+[a-z]?\s*\|/.test(line))
    .map((line) => {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim().replace(/[*`]/g, ""));
      return {
        id: cells[0],
        state: cells[1],
        dependencies: cells[2].match(/\bT\d+[a-z]?\b/g) ?? [],
      };
    });
}

export function validateTasks(markdown) {
  const rows = taskRows(markdown);
  const errors = [];
  const graph = new Map();
  const definitions = markdown
    .split(/\r?\n/)
    .filter((line) => /^#{2,6}\s/.test(line) || /^\|\s*T\d/.test(line))
    .map((line) => (line.startsWith("|") ? line.split("|")[1] : line));
  const known = new Set(
    definitions.flatMap((line) => line.match(/\bT\d+[a-z]?\b/g) ?? []),
  );
  for (const row of rows) {
    if (graph.has(row.id)) errors.push(`Duplicate executable task: ${row.id}`);
    if (
      !/^(TODO|READY|IN_PROGRESS|BLOCKED|DONE|PAUSED|DEFERRED)$/.test(row.state)
    )
      errors.push(`Invalid task state: ${row.id}`);
    for (const dependency of row.dependencies)
      if (!known.has(dependency))
        errors.push(`Unknown prerequisite: ${row.id} -> ${dependency}`);
    graph.set(row.id, row.dependencies);
  }
  const visited = new Set();
  function visit(id, trail = []) {
    if (trail.includes(id)) {
      errors.push(`Task cycle: ${[...trail, id].join(" -> ")}`);
      return;
    }
    if (visited.has(id) || !graph.has(id)) return;
    for (const dependency of graph.get(id)) visit(dependency, [...trail, id]);
    visited.add(id);
  }
  for (const id of graph.keys()) visit(id);
  if (!rows.length) errors.push("Missing executable task table");
  return { rows, errors: [...new Set(errors)] };
}

export function declarationKeys(declarations) {
  return declarations
    .map(
      ({ manifest, section, name, pin }) =>
        `${manifest}|${section}|${name}|${pin}`,
    )
    .sort();
}

const scopes = [
  "app/AGENTS.md",
  "app/apps/web/AGENTS.md",
  "app/apps/mobile/AGENTS.md",
  "app/apps/web/src/features/discovery/AGENTS.md",
  "app/apps/web/src/features/sellers/AGENTS.md",
];
const skills = [
  "treido-task",
  "treido-visual-parity",
  "treido-nextjs",
  "treido-backend",
];
const manifests = [
  "app/package.json",
  "app/apps/web/package.json",
  "app/apps/mobile/package.json",
  "app/packages/contracts/package.json",
];

export async function checkRepository(directory) {
  const root = await realpath(directory);
  const errors = [];
  const documents = [
    ...scopes,
    ...skills.map((name) => `.agents/skills/${name}/SKILL.md`),
  ];
  for (const folder of ["", "docs"]) {
    for (const entry of await readdir(path.join(root, folder), {
      withFileTypes: true,
    })) {
      if (entry.isFile() && entry.name.endsWith(".md"))
        documents.push(path.join(folder, entry.name));
    }
  }
  const text = new Map();
  const load = async (file) => {
    const canonical = await realpath(file);
    if (!inside(root, canonical)) throw new Error("Read escapes repository");
    if (!text.has(file)) text.set(file, await readFile(file, "utf8"));
    return text.get(file);
  };
  let links = 0;
  let anchors = 0;
  for (const relative of documents) {
    try {
      const body = await load(path.join(root, relative));
      for (const href of linksIn(body)) {
        try {
          const resolved = localTarget(root, relative, href);
          if (!resolved) continue;
          links++;
          const canonical = await realpath(resolved.target);
          if (!inside(root, canonical))
            throw new Error("Symlink escapes repository");
          if (resolved.anchor) {
            anchors++;
            if (!canonical.endsWith(".md") || !(await stat(canonical)).isFile())
              throw new Error("Anchor target is not Markdown");
            if (!headingAnchors(await load(canonical)).has(resolved.anchor))
              throw new Error(`Missing anchor #${resolved.anchor}`);
          }
        } catch (error) {
          errors.push(`${relative}: ${href}: ${error.message}`);
        }
      }
    } catch (error) {
      errors.push(`${relative}: ${error.message}`);
    }
  }
  const rootAgents = await load(path.join(root, "AGENTS.md"));
  for (const link of [
    "docs/ui-patterns.md",
    "docs/ui-verification.md",
    "docs/documentation.md",
  ]) {
    if (!rootAgents.includes(link))
      errors.push(`Root AGENTS missing routing: ${link}`);
  }
  for (const name of skills) {
    const body = await load(path.join(root, `.agents/skills/${name}/SKILL.md`));
    if (
      !body.startsWith("---") ||
      !body.includes(`\nname: ${name}\n`) ||
      !/^description:\s+\S/m.test(body)
    )
      errors.push(`Invalid skill metadata: ${name}`);
    if (!rootAgents.includes(name))
      errors.push(`Skill missing root routing: ${name}`);
  }
  const webAgents = await load(path.join(root, "app/apps/web/AGENTS.md"));
  const begin = "<!-- BEGIN:nextjs-agent-rules -->";
  const end = "<!-- END:nextjs-agent-rules -->";
  if (
    webAgents.split(begin).length !== 2 ||
    webAgents.split(end).length !== 2 ||
    webAgents.indexOf(begin) > webAgents.indexOf(end)
  )
    errors.push("Missing/invalid generated Next instruction block");
  const commonAgents =
    rootAgents + (await load(path.join(root, "app/AGENTS.md"))) + webAgents;
  for (const scope of scopes.filter((file) => file.includes("/features/"))) {
    if (
      Buffer.byteLength(commonAgents + (await load(path.join(root, scope)))) >
      24 * 1024
    )
      errors.push(`Project agent context budget exceeded: ${scope}`);
  }
  const tasks = validateTasks(await load(path.join(root, "tasks.md")));
  errors.push(...tasks.errors);
  const stack = await load(path.join(root, "techstack.md"));
  const snapshotPath = stack.match(
    /\]\((docs\/audit\/dependencies-\d{4}-\d{2}-\d{2}\.json)\)/,
  )?.[1];
  let dependencyDeclarations = 0;
  if (!snapshotPath)
    errors.push("Tech stack missing dated dependency snapshot");
  else {
    const snapshot = JSON.parse(await load(path.join(root, snapshotPath)));
    const actual = [];
    for (const manifest of manifests) {
      const pkg = JSON.parse(await load(path.join(root, manifest)));
      for (const section of ["dependencies", "devDependencies"]) {
        for (const [name, pin] of Object.entries(pkg[section] ?? {})) {
          if (!pin.startsWith("workspace:"))
            actual.push({ manifest, section, name, pin });
        }
      }
    }
    dependencyDeclarations = actual.length;
    if (
      JSON.stringify(declarationKeys(actual)) !==
      JSON.stringify(declarationKeys(snapshot.declarations ?? []))
    )
      errors.push(
        "Dependency snapshot differs from current manifest declarations",
      );
    const workspace = JSON.parse(
      await load(path.join(root, "app/package.json")),
    );
    const node = (await load(path.join(root, "app/.node-version"))).trim();
    if (
      snapshot.runtime?.declaredPackageManager !== workspace.packageManager ||
      snapshot.runtime?.declaredNode !== node
    )
      errors.push("Runtime pins differ from documented snapshot");
  }
  return {
    documents: documents.length,
    links,
    anchors,
    skills: skills.length,
    executableTasks: tasks.rows.length,
    dependencyDeclarations,
    errors,
  };
}

const invoked =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invoked) {
  try {
    const result = await checkRepository(
      fileURLToPath(new URL("../../", import.meta.url)),
    );
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.errors.length ? 1 : 0;
  } catch (error) {
    console.error(`Product documentation check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
