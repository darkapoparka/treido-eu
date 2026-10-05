import { readFile, readdir, realpath, stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

const packagePath =
  /(?:^|[\\/])(?:node-forge|braces|micromatch)(?:@[^\\/]+)?(?:[\\/]|$)/i;
const importMarker =
  /(?:node_modules[\\/](?:\.pnpm[\\/])?(?:node-forge|braces|micromatch)(?:@|[\\/]))|(?:require|import)\s*\(\s*["'](?:node-forge|braces|micromatch)(?:[\\/][^"']*)?["']|\b(?:from|import)\s*["'](?:node-forge|braces|micromatch)(?:[\\/][^"']*)?["']/;

// Invoke after the existing output-confinement guard. Inspect qualified external
// runtime links too; a dependency graph alone does not inspect compiled output.
export async function auditDependencyOutput(outputDirectory) {
  const output = resolve(outputDirectory);
  const visited = new Set();
  const findings = [];
  let tracesChecked = 0;
  let bundlesChecked = 0;
  async function inspect(directory) {
    const physical = await realpath(directory);
    if (visited.has(physical)) return;
    visited.add(physical);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = resolve(directory, entry.name);
      const name = relative(output, absolute).split(sep).join("/");
      if (packagePath.test(name))
        findings.push({ path: name, kind: "package path" });
      const details = entry.isSymbolicLink() ? await stat(absolute) : entry;
      if (details.isDirectory()) {
        await inspect(absolute);
      } else if (details.isFile() && name.endsWith(".nft.json")) {
        tracesChecked++;
        const trace = JSON.parse(await readFile(absolute, "utf8"));
        if (
          !Array.isArray(trace.files) ||
          !trace.files.every((file) => typeof file === "string")
        )
          throw new Error(`Invalid dependency trace: ${name}`);
        for (const file of trace.files) {
          if (packagePath.test(file))
            findings.push({
              path: name,
              dependency: file,
              kind: "traced package",
            });
        }
      } else if (details.isFile() && /\.(?:m?js|cjs|map)$/.test(name)) {
        bundlesChecked++;
        if (importMarker.test(await readFile(absolute, "utf8")))
          findings.push({ path: name, kind: "package import/path marker" });
      }
    }
  }
  await inspect(output);
  return {
    forbiddenPackages: ["node-forge", "braces", "micromatch"],
    tracesChecked,
    bundlesChecked,
    findings,
  };
}
