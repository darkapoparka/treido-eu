import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

export const workspace = resolve(import.meta.dirname, "../..");

export function packageRoot(name: string, version: string) {
  // Follow actual consumers for patched packages, including after frozen install.
  // Old unused virtual-store directories must not select an unpatched copy.
  if (name === "braces" || name === "node-forge") {
    let consumer;
    if (name === "braces") {
      consumer = createRequire(
        resolve(packageRoot("micromatch", "4.0.8"), "package.json"),
      );
    } else {
      const mobile = createRequire(
        resolve(workspace, "apps/mobile/package.json"),
      );
      const expo = createRequire(mobile.resolve("expo"));
      consumer = createRequire(expo.resolve("@expo/cli"));
    }
    const manifest = consumer.resolve(`${name}/package.json`);
    if (consumer(manifest).version !== version)
      throw new Error(`Unexpected ${name} version`);
    return dirname(manifest);
  }
  const store = resolve(workspace, "node_modules/.pnpm");
  const prefix = `${name.replaceAll("/", "+")}@${version}`;
  const entries = readdirSync(store).filter(
    (entry) => entry === prefix || entry.startsWith(`${prefix}_`),
  );
  if (entries.length !== 1) {
    throw new Error(
      `Expected one installed ${name}@${version}, got ${entries}`,
    );
  }
  return resolve(store, entries[0], "node_modules", name);
}

type Hunk = { oldStart: number; newStart: number; lines: string[] };
type FilePatch = { file: string; hunks: Hunk[] };

function readPatch(name: string, version: string): FilePatch[] {
  const patches: FilePatch[] = [];
  for (const line of readFileSync(
    resolve(workspace, `patches/${name}@${version}.patch`),
    "utf8",
  ).split("\n")) {
    if (line.startsWith("diff --git ")) {
      patches.push({ file: line.split(" b/")[1], hunks: [] });
    } else if (line.startsWith("@@ ")) {
      const match = /^@@ -(\d+),(\d+) \+(\d+),(\d+) @@$/.exec(line);
      if (!match) throw new Error(`Unsupported patch header: ${line}`);
      patches.at(-1)!.hunks.push({
        oldStart: Number(match[1]),
        newStart: Number(match[3]),
        lines: [],
      });
    } else if (/^[ +-]/.test(line) && !/^(---|\+\+\+)/.test(line)) {
      patches.at(-1)!.hunks.at(-1)!.lines.push(line);
    }
  }
  return patches;
}

// Exact-context application in memory; no pnpm install or package writes.
function apply(source: string, patch: FilePatch, reverse = false) {
  const lines = source ? source.slice(0, -1).split("\n") : [];
  let offset = 0;
  for (const hunk of patch.hunks) {
    const removed = reverse ? "+" : "-";
    const added = reverse ? "-" : "+";
    const before = hunk.lines
      .filter((line) => line[0] !== added)
      .map((line) => line.slice(1));
    const after = hunk.lines
      .filter((line) => line[0] !== removed)
      .map((line) => line.slice(1));
    const at =
      Math.max(0, (reverse ? hunk.newStart : hunk.oldStart) - 1) + offset;
    if (!before.every((line, index) => lines[at + index] === line)) {
      throw new Error(`Patch context mismatch: ${patch.file}`);
    }
    lines.splice(at, before.length, ...after);
    offset += after.length - before.length;
  }
  return lines.length ? `${lines.join("\n")}\n` : "";
}

const originalHashes: Record<string, Record<string, string>> = {
  "node-forge": {
    "lib/rsa.js":
      "fd4740238145ec26470eb3f06a627c72039538ce1307dbdce40521f94dfd0a50",
  },
  braces: {
    "lib/parse.js":
      "e572166565f15fa6ad9865ae49d678218e32aabfd1b3720f6d0d43d39800d310",
    "lib/compile.js":
      "dc98f22eee3d511785d92a00758d5f0d48efed5f5813bdecc2de430c529b5c9f",
    "lib/expand.js":
      "41ccc196ebfa7b7781a634e721eb744e4e7bcb54cba427a7e3d6806a1b9e58f7",
    "lib/stringify.js":
      "379f22d77bfa1478341ccd49c5e4267464aabcbba03558bab332aac23fc6f23a",
  },
};

export function sourcePackage(name: string, version: string, patched: boolean) {
  const root = packageRoot(name, version);
  const sources = new Map<string, string>();
  for (const patch of readPatch(name, version)) {
    const file = resolve(root, patch.file);
    const installed = existsSync(file) ? readFileSync(file, "utf8") : "";
    const expected = originalHashes[name][patch.file];
    const hash = (source: string) =>
      createHash("sha256").update(source).digest("hex");
    const original =
      (expected && hash(installed) === expected) ||
      (!expected && installed === "")
        ? installed
        : apply(installed, patch, true);
    if (expected ? hash(original) !== expected : original !== "") {
      throw new Error(`Unexpected original package source: ${file}`);
    }
    sources.set(file, patched ? apply(original, patch) : original);
  }
  return { root, sources };
}

// Isolated CommonJS caches retain the genuine package APIs/crypto/walkers.
// Optional consumer roots exercise micromatch/fast-glob against the same patch.
export function memoryRequire(
  packages: { root: string; sources: Map<string, string> }[],
) {
  const cache = new Map<string, { exports: unknown }>();
  function load(file: string): unknown {
    if (!isAbsolute(file))
      return createRequire(resolve(workspace, "package.json"))(file);
    const nativeRequire = createRequire(file);
    const owner = packages.find(({ root }) => {
      const path = relative(root, file);
      return !isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`);
    });
    if (!owner || !file.endsWith(".js")) return nativeRequire(file);
    if (cache.has(file)) return cache.get(file)!.exports;
    const module = { exports: {} };
    cache.set(file, module);
    const localRequire = Object.assign((specifier: string) => {
      const added = resolve(dirname(file), `${specifier}.js`);
      return load(
        specifier.startsWith(".") && owner.sources.has(added)
          ? added
          : nativeRequire.resolve(specifier),
      );
    }, nativeRequire);
    const source = owner.sources.get(file) ?? readFileSync(file, "utf8");
    const evaluate = new Function(
      "exports",
      "require",
      "module",
      "__filename",
      "__dirname",
      source,
    );
    evaluate(module.exports, localRequire, module, file, dirname(file));
    return module.exports;
  }
  return load;
}
