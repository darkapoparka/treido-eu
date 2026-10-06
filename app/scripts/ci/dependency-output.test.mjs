import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { URL } from "node:url";
import { tmpdir } from "node:os";
import { basename, dirname, join, parse, resolve } from "node:path";
import test from "node:test";
import { auditDependencyOutput } from "./dependency-output.mjs";

async function fixture(
  t,
  files = [],
  code = "const braces = {}; export {braces};",
) {
  const temporary = resolve(tmpdir());
  const output = await mkdtemp(join(temporary, "treido-dependency-output-"));
  t.after(async () => {
    const target = resolve(output);
    assert.equal(dirname(target), temporary);
    assert.ok(basename(target).startsWith("treido-dependency-output-"));
    assert.notEqual(target, parse(target).root);
    await rm(target, { recursive: true, force: true });
  });
  await writeFile(join(output, "page.js.nft.json"), JSON.stringify({ files }));
  await writeFile(join(output, "page.js"), code);
  return output;
}

test("ordinary application words are not package evidence", async (t) => {
  const output = await fixture(t, ["../../node_modules/next/server.js"]);
  assert.deepEqual(await auditDependencyOutput(output), {
    forbiddenPackages: ["node-forge", "braces", "micromatch"],
    tracesChecked: 1,
    bundlesChecked: 1,
    findings: [],
  });
});

for (const name of ["node-forge", "braces", "micromatch"]) {
  test(`rejects ${name} traced through a versioned pnpm package`, async (t) => {
    const output = await fixture(t, [
      `../../node_modules/.pnpm/${name}@1.0.0_patch_hash/node_modules/${name}/index.js`,
    ]);
    assert.equal(
      (await auditDependencyOutput(output)).findings[0].kind,
      "traced package",
    );
  });
}

test("recognizes Windows trace paths", async (t) => {
  const output = await fixture(t, ["..\\node_modules\\braces\\index.js"]);
  assert.equal(
    (await auditDependencyOutput(output)).findings[0].kind,
    "traced package",
  );
});

for (const code of [
  'const glob = require("micromatch");',
  'const rsa = await import("node-forge/lib/rsa.js");',
  'import parse from "braces";',
  'import "node-forge";',
]) {
  test(`rejects bundle import marker: ${code}`, async (t) => {
    const output = await fixture(t, [], code);
    assert.equal(
      (await auditDependencyOutput(output)).findings[0].kind,
      "package import/path marker",
    );
  });
}

test("detects a forbidden emitted package even when a trace omits it", async (t) => {
  const output = await fixture(t);
  await mkdir(join(output, "node_modules/braces"), { recursive: true });
  await writeFile(
    join(output, "node_modules/braces/index.js"),
    "module.exports = {};",
  );
  assert.ok(
    (await auditDependencyOutput(output)).findings.some(
      (finding) => finding.kind === "package path",
    ),
  );
});

test("malformed trace cannot produce a clean report", async (t) => {
  const output = await fixture(t);
  await writeFile(join(output, "page.js.nft.json"), '{"files":[42]}');
  await assert.rejects(
    auditDependencyOutput(output),
    /Invalid dependency trace/,
  );
});

test("deployment guard never invokes dependency walker after failed confinement", async (t) => {
  const directory = await fixture(t);
  const scripts = join(directory, "scripts/ci");
  const output = join(directory, "apps/web/.next");
  await mkdir(scripts, { recursive: true });
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "page.js.nft.json"), '{"files":[]}');
  for (const file of ["deploy-output.mjs", "production-output.mjs"])
    await writeFile(
      join(scripts, file),
      await readFile(new URL(file, import.meta.url)),
    );
  await writeFile(
    join(scripts, "dependency-output.mjs"),
    'export async function auditDependencyOutput(){throw Error("DENIED_WALKER_INVOKED");}',
  );
  const child = spawnSync(
    process.execPath,
    [join(scripts, "deploy-output.mjs")],
    { encoding: "utf8" },
  );
  assert.equal(child.status, 1);
  assert.match(child.stdout, /Missing production BUILD_ID/);
  assert.doesNotMatch(child.stderr, /DENIED_WALKER_INVOKED/);
});

async function ciFixture(t, { buildId = true, dependencyWalker } = {}) {
  const directory = await fixture(t);
  const scripts = join(directory, "scripts/ci");
  const output = join(directory, "apps/web/.qa/treido-ci");
  await mkdir(scripts, { recursive: true });
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "page.js.nft.json"), '{"files":[]}');
  if (buildId) await writeFile(join(output, "BUILD_ID"), "synthetic-ci-build");
  for (const file of ["production-output.mjs", "dependency-output.mjs"])
    await writeFile(
      join(scripts, file),
      dependencyWalker && file === "dependency-output.mjs"
        ? dependencyWalker
        : await readFile(new URL(file, import.meta.url)),
    );
  return {
    output,
    run: () =>
      spawnSync(process.execPath, [join(scripts, "production-output.mjs")], {
        encoding: "utf8",
        timeout: 10000,
      }),
  };
}

test("CI entry checks clean dependency output after confinement", async (t) => {
  const { run } = await ciFixture(t);
  const child = run();
  assert.equal(child.error, undefined);
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /"dependencyOutput"/);
  assert.match(child.stdout, /"tracesChecked": 1/);
  assert.match(child.stdout, /"findings": \[\]/);
});

test("CI entry rejects an emitted forbidden package absent from traces", async (t) => {
  const { output, run } = await ciFixture(t);
  await mkdir(join(output, "node_modules/braces"), { recursive: true });
  await writeFile(join(output, "node_modules/braces/index.js"), "export {};");
  const child = run();
  assert.equal(child.error, undefined);
  assert.equal(child.status, 1, child.stderr);
  assert.match(child.stdout, /"dependencyOutput"/);
  assert.match(child.stdout, /"kind": "package path"/);
});

test("CI entry refuses the dependency walk after failed confinement", async (t) => {
  const { run } = await ciFixture(t, {
    buildId: false,
    dependencyWalker:
      'export async function auditDependencyOutput(){throw Error("DENIED_WALKER_INVOKED");}',
  });
  const child = run();
  assert.equal(child.error, undefined);
  assert.equal(child.status, 1);
  assert.match(child.stdout, /Missing production BUILD_ID/);
  assert.doesNotMatch(child.stdout + child.stderr, /DENIED_WALKER_INVOKED/);
});

test("CI entry cannot pass when a dependency walker reports zero traces", async (t) => {
  const { run } = await ciFixture(t, {
    dependencyWalker:
      "export async function auditDependencyOutput(){return {tracesChecked:0,findings:[]};}",
  });
  const child = run();
  assert.equal(child.error, undefined);
  assert.equal(child.status, 1);
  assert.match(child.stdout, /"tracesChecked": 0/);
});
