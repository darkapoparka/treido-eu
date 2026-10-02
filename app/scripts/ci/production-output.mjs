import { readdir, readFile, realpath } from "node:fs/promises";
import { log } from "node:console";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import process from "node:process";
import { URL, fileURLToPath } from "node:url";

const privateDirectories = new Set([
  ".local",
  "mobbin-shop",
  "reference-assets",
  "private-evidence",
  "_references",
]);
const capturedMedia = /\.(?:woff2?|ttf|otf|mp4|webm)$/i;

async function isPinnedPostgresLink(path, name, output, workspace) {
  if (
    dirname(path) !== resolve(output, "node_modules") ||
    !/^pg-[a-f0-9]{16}$/.test(name)
  )
    return false;
  const manifest = JSON.parse(
    await readFile(resolve(workspace, "apps/web/package.json"), "utf8"),
  );
  const version = manifest.dependencies?.pg;
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version))
    return false;
  const target = await realpath(path);
  const expected = await realpath(
    resolve(
      workspace,
      "node_modules/.pnpm",
      `pg@${version}`,
      "node_modules/pg",
    ),
  );
  const inside = relative(workspace, target);
  if (
    target !== expected ||
    isAbsolute(inside) ||
    inside === ".." ||
    inside.startsWith(`..${sep}`) ||
    inside.split(sep).some((part) => privateDirectories.has(part))
  )
    return false;
  const installed = JSON.parse(
    await readFile(resolve(target, "package.json"), "utf8"),
  );
  return installed.name === "pg" && installed.version === version;
}

async function isPinnedSharpLink(path, name, output, workspace) {
  if (
    dirname(path) !== resolve(output, "node_modules") ||
    !/^sharp-[a-f0-9]{16}$/.test(name)
  )
    return false;
  const manifest = JSON.parse(
    await readFile(resolve(workspace, "apps/web/package.json"), "utf8"),
  );
  const version = manifest.dependencies?.sharp;
  const nodeTypes = manifest.devDependencies?.["@types/node"];
  if (
    typeof version !== "string" ||
    !/^\d+\.\d+\.\d+$/.test(version) ||
    typeof nodeTypes !== "string" ||
    !/^\d+\.\d+\.\d+$/.test(nodeTypes)
  )
    return false;
  const target = await realpath(path);
  const expected = await realpath(
    resolve(
      workspace,
      "node_modules/.pnpm",
      `sharp@${version}_@types+node@${nodeTypes}`,
      "node_modules/sharp",
    ),
  );
  const inside = relative(workspace, target);
  if (
    target !== expected ||
    isAbsolute(inside) ||
    inside === ".." ||
    inside.startsWith(`..${sep}`) ||
    inside.split(sep).some((part) => privateDirectories.has(part))
  )
    return false;
  const installed = JSON.parse(
    await readFile(resolve(target, "package.json"), "utf8"),
  );
  return installed.name === "sharp" && installed.version === version;
}

async function filesUnder(directory, output, workspace) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) {
      // Next 16 Turbopack links this external server package into its output.
      // Only exact owned, manifest-pinned pg and raster-processing Sharp packages
      // are allowed. Traversal
      // still rejects nested links and checks its emitted files for private media.
      if (
        !(await isPinnedPostgresLink(path, entry.name, output, workspace)) &&
        !(await isPinnedSharpLink(path, entry.name, output, workspace))
      )
        throw new Error(`Unexpected link in production output: ${path}`);
      files.push(...(await filesUnder(path, output, workspace)));
    } else if (entry.isDirectory())
      files.push(...(await filesUnder(path, output, workspace)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

export async function auditProductionOutput(
  outputDirectory,
  workspaceDirectory,
) {
  const workspace = resolve(workspaceDirectory);
  const output = resolve(outputDirectory);
  const files = await filesUnder(output, output, workspace);
  const traces = files.filter((path) => path.endsWith(".nft.json"));
  const issues = [];
  if (!files.includes(resolve(output, "BUILD_ID")))
    issues.push("Missing production BUILD_ID");
  if (!traces.length) issues.push("No production dependency traces found");

  for (const trace of traces) {
    const data = JSON.parse(await readFile(trace, "utf8"));
    if (
      !Array.isArray(data.files) ||
      !data.files.every((p) => typeof p === "string")
    )
      throw new Error(`Invalid dependency trace: ${relative(output, trace)}`);
    for (const file of data.files) {
      const path = resolve(trace, "..", file);
      const inside = relative(workspace, path);
      if (
        inside === ".." ||
        inside.startsWith(`..${sep}`) ||
        isAbsolute(inside)
      )
        issues.push(`Dependency escapes workspace: ${file}`);
      else if (inside.split(sep).some((part) => privateDirectories.has(part)))
        issues.push(`Private reference dependency: ${inside}`);
    }
  }
  for (const file of files) {
    if (capturedMedia.test(file))
      issues.push(`Unqualified font/video output: ${relative(output, file)}`);
  }
  return { tracesChecked: traces.length, issues };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const workspace = fileURLToPath(new URL("../../", import.meta.url));
  const output = resolve(workspace, "apps/web/.qa/treido-ci");
  const result = await auditProductionOutput(output, workspace);
  log(JSON.stringify(result, null, 2));
  if (result.issues.length) process.exitCode = 1;
}
