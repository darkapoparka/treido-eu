import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { log } from "node:console";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import process from "node:process";
import { URL, fileURLToPath } from "node:url";

const privateDirectories = new Set([
  ".local",
  "mobbin-shop",
  "reference-assets",
  "private-evidence",
  "_references",
  "reference-live",
]);
const capturedMedia = /\.(?:woff2?|ttf|otf|mp4|webm)$/i;

async function isQualifiedMerchantFont(file, output) {
  if (
    relative(output, file).split(sep).join("/") !==
    "output/static/fonts/admin/InterVariable.woff2"
  )
    return false;
  // October 2 approved merchant asset, independently matched to the official
  // Inter distribution. Retain its exact bytes and accompanying upstream OFL.
  try {
    const [font, license] = await Promise.all([
      readFile(file),
      readFile(resolve(dirname(file), "OFL.txt"), "utf8"),
    ]);
    return (
      createHash("sha256").update(font).digest("hex") ===
        "693b77d4f32ee9b8bfc995589b5fad5e99adf2832738661f5402f9978429a8e3" &&
      createHash("sha256")
        .update(license.replace(/\r\n/g, "\n"))
        .digest("hex") ===
        "262481e844521b326f5ecd053e59b98c8b2da78c8ee1bdbb6e8174305e54935a"
    );
  } catch {
    return false;
  }
}

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

async function isPinnedInngestLink(path, name, output, workspace) {
  if (
    dirname(path) !== resolve(output, "node_modules") ||
    !/^inngest-[a-f0-9]{16}$/.test(name)
  )
    return false;
  const manifest = JSON.parse(
    await readFile(resolve(workspace, "apps/web/package.json"), "utf8"),
  );
  const version = manifest.dependencies?.inngest;
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version))
    return false;
  const target = await realpath(path);
  // pnpm hashes long peer contexts. Bind to the web importer's actual frozen
  // installation rather than guessing a platform-specific virtual-store hash.
  const expected = await realpath(
    resolve(workspace, "apps/web/node_modules/inngest"),
  );
  const inside = relative(workspace, target);
  const store = relative(
    resolve(workspace, "node_modules/.pnpm"),
    target,
  ).split(sep);
  if (
    target !== expected ||
    isAbsolute(inside) ||
    inside === ".." ||
    inside.startsWith(`..${sep}`) ||
    inside.split(sep).some((part) => privateDirectories.has(part)) ||
    store.length !== 3 ||
    !(
      store[0] === `inngest@${version}` ||
      store[0].startsWith(`inngest@${version}_`)
    ) ||
    store[1] !== "node_modules" ||
    store[2] !== "inngest"
  )
    return false;
  const installed = JSON.parse(
    await readFile(resolve(target, "package.json"), "utf8"),
  );
  return installed.name === "inngest" && installed.version === version;
}

async function isHostedFunctionLink(path, name, output) {
  // Vercel permits route aliases between .func directories in its generated
  // function tree. Resolve both sides so parent links cannot escape that tree.
  const functions = resolve(output, "output/functions");
  const alias = relative(functions, path);
  if (
    !name.endsWith(".func") ||
    isAbsolute(alias) ||
    alias === ".." ||
    alias.startsWith(`..${sep}`) ||
    alias
      .split(sep)
      .slice(0, -1)
      .some((part) => part.endsWith(".func"))
  )
    return false;
  const target = await realpath(path);
  const inside = relative(await realpath(functions), target);
  return (
    target.endsWith(".func") &&
    !isAbsolute(inside) &&
    inside !== ".." &&
    !inside.startsWith(`..${sep}`) &&
    !inside.split(sep).some((part) => privateDirectories.has(part)) &&
    (await stat(target)).isDirectory()
  );
}

async function filesUnder(directory, output, workspace, visited = new Set()) {
  const canonical = await realpath(directory);
  if (visited.has(canonical)) return [];
  visited.add(canonical);
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) {
      if (await isHostedFunctionLink(path, entry.name, output)) {
        files.push(
          ...(await filesUnder(
            await realpath(path),
            output,
            workspace,
            visited,
          )),
        );
        continue;
      }
      // Next 16 Turbopack emits external runtime packages as links. Only the
      // qualified, manifest-pinned pg, Sharp and importer-bound Inngest packages
      // are allowed. Nested links and captured media are still rejected.
      if (
        !(await isPinnedPostgresLink(path, entry.name, output, workspace)) &&
        !(await isPinnedSharpLink(path, entry.name, output, workspace)) &&
        !(await isPinnedInngestLink(path, entry.name, output, workspace))
      )
        throw new Error(`Unexpected link in production output: ${path}`);
      files.push(...(await filesUnder(path, output, workspace, visited)));
    } else if (entry.isDirectory())
      files.push(...(await filesUnder(path, output, workspace, visited)));
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
    if (
      capturedMedia.test(file) &&
      !(await isQualifiedMerchantFont(file, output))
    )
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
