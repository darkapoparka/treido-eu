import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, parse, relative, resolve } from "node:path";
import test from "node:test";
import { auditProductionOutput } from "./production-output.mjs";

async function fixture(t, dependencies = []) {
  const temporary = resolve(tmpdir());
  const workspace = await mkdtemp(join(temporary, "treido-ci-output-"));
  t.after(async () => {
    const target = resolve(workspace);
    assert.equal(dirname(target), temporary);
    assert.ok(basename(target).startsWith("treido-ci-output-"));
    assert.notEqual(target, parse(target).root);
    await rm(target, { recursive: true, force: true });
  });
  const output = join(workspace, "apps/web/.qa/treido-ci");
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "BUILD_ID"), "fixture-build");
  await writeFile(
    join(output, "page.js.nft.json"),
    JSON.stringify({
      files: dependencies.map((path) => relative(output, path(workspace))),
    }),
  );
  return { workspace, output };
}

test("accepts bounded dependencies and a completed production build", async (t) => {
  const { workspace, output } = await fixture(t, [
    (root) => join(root, "node_modules/next/server.js"),
    (root) =>
      join(root, "apps/web/src/features/catalog/reference/adapter.server.ts"),
  ]);
  assert.deepEqual(await auditProductionOutput(output, workspace), {
    tracesChecked: 1,
    issues: [],
  });
});

test("rejects traced dependencies outside the workspace", async (t) => {
  const { workspace, output } = await fixture(t, [
    (root) => join(root, "../private-capture/font.ttf"),
  ]);
  const result = await auditProductionOutput(output, workspace);
  assert.match(result.issues.join("\n"), /escapes workspace/);
});

test("rejects private reference archives inside the workspace", async (t) => {
  const { workspace, output } = await fixture(t, [
    (root) => join(root, ".local/archive/image.png"),
    (root) => join(root, "apps/web/reference-assets/font.ttf"),
  ]);
  const result = await auditProductionOutput(output, workspace);
  assert.equal(
    result.issues.filter((issue) => issue.includes("Private reference")).length,
    2,
  );
});

test("rejects an incomplete build even when it has traces", async (t) => {
  const { workspace, output } = await fixture(t);
  await rm(join(output, "BUILD_ID"));
  assert.match(
    (await auditProductionOutput(output, workspace)).issues.join("\n"),
    /BUILD_ID/,
  );
});

test("rejects a build without dependency traces", async (t) => {
  const { workspace, output } = await fixture(t);
  await rm(join(output, "page.js.nft.json"));
  assert.match(
    (await auditProductionOutput(output, workspace)).issues.join("\n"),
    /No production dependency traces/,
  );
});

test("rejects unqualified emitted font and video bytes", async (t) => {
  const { workspace, output } = await fixture(t);
  await writeFile(join(output, "reference.woff2"), "font");
  await writeFile(join(output, "reference.mp4"), "video");
  assert.equal(
    (await auditProductionOutput(output, workspace)).issues.length,
    2,
  );
});

test("malformed dependency traces fail rather than reporting success", async (t) => {
  const { workspace, output } = await fixture(t);
  await writeFile(
    join(output, "page.js.nft.json"),
    JSON.stringify({ files: [null] }),
  );
  await assert.rejects(
    auditProductionOutput(output, workspace),
    /Invalid dependency trace/,
  );
});

test("missing output fails rather than reporting a clean build", async (t) => {
  const { workspace, output } = await fixture(t);
  await assert.rejects(
    auditProductionOutput(join(output, "missing"), workspace),
    /ENOENT/,
  );
});

async function postgresLink(t, mode = "valid") {
  const { workspace, output } = await fixture(t);
  const target = join(
    workspace,
    "node_modules/.pnpm/pg@8.23.1/node_modules/pg",
  );
  await mkdir(target, { recursive: true });
  await writeFile(
    join(workspace, "apps/web/package.json"),
    JSON.stringify({ dependencies: { pg: "8.23.1" } }),
  );
  await writeFile(
    join(target, "package.json"),
    JSON.stringify({
      name: "pg",
      version: mode === "wrong-version" ? "8.23.0" : "8.23.1",
    }),
  );
  const linkTarget =
    mode === "private"
      ? join(workspace, ".local/pg")
      : mode === "escaped"
        ? (await fixture(t)).workspace
        : target;
  if (mode === "private") await mkdir(linkTarget, { recursive: true });
  await mkdir(join(output, "node_modules"));
  await symlink(
    linkTarget,
    join(
      output,
      "node_modules",
      mode === "other-link" ? "unreviewed" : "pg-ad45e98bb7b7a165",
    ),
    "junction",
  );
  return { workspace, output, target };
}

test("accepts only the pinned owned pg runtime junction emitted by Turbopack", async (t) => {
  const { workspace, output } = await postgresLink(t);
  assert.deepEqual(await auditProductionOutput(output, workspace), {
    tracesChecked: 1,
    issues: [],
  });
});

for (const mode of ["wrong-version", "private", "other-link", "escaped"]) {
  test(`rejects a pg-shaped runtime junction with ${mode}`, async (t) => {
    const { workspace, output } = await postgresLink(t, mode);
    await assert.rejects(
      auditProductionOutput(output, workspace),
      /Unexpected link/,
    );
  });
}

test("still rejects private media and nested junctions inside an allowed pg package", async (t) => {
  const { workspace, output, target } = await postgresLink(t);
  await writeFile(join(target, "unqualified.woff2"), "font fixture");
  assert.match(
    (await auditProductionOutput(output, workspace)).issues.join("\n"),
    /Unqualified font/,
  );
  const privateTarget = join(workspace, ".local/archive");
  await mkdir(privateTarget, { recursive: true });
  await symlink(privateTarget, join(target, "nested"), "junction");
  await assert.rejects(
    auditProductionOutput(output, workspace),
    /Unexpected link/,
  );
});

async function sharpLink(t, mode = "valid") {
  const { workspace, output } = await fixture(t);
  const target = join(
    workspace,
    "node_modules/.pnpm/sharp@0.35.4_@types+node@24.13.3/node_modules/sharp",
  );
  await mkdir(target, { recursive: true });
  await writeFile(
    join(workspace, "apps/web/package.json"),
    JSON.stringify({
      dependencies: { sharp: "0.35.4" },
      devDependencies: {
        "@types/node": mode === "unpinned" ? "^24.13.3" : "24.13.3",
      },
    }),
  );
  await writeFile(
    join(target, "package.json"),
    JSON.stringify({
      name: "sharp",
      version: mode === "wrong-version" ? "0.35.3" : "0.35.4",
    }),
  );
  const actual =
    mode === "escaped"
      ? (await fixture(t)).workspace
      : mode === "private"
        ? join(workspace, ".local/sharp")
        : target;
  await mkdir(actual, { recursive: true });
  await mkdir(join(output, "node_modules"));
  await symlink(
    actual,
    join(
      output,
      "node_modules",
      mode === "other-link" ? "sharp-custom" : "sharp-588826cebbe5c4db",
    ),
    "junction",
  );
  return { workspace, output, target };
}
test("accepts only the exact pinned owned Sharp runtime needed by private photo processing", async (t) => {
  const { workspace, output } = await sharpLink(t);
  assert.deepEqual(await auditProductionOutput(output, workspace), {
    tracesChecked: 1,
    issues: [],
  });
});
for (const mode of [
  "unpinned",
  "wrong-version",
  "escaped",
  "private",
  "other-link",
]) {
  test(`rejects a Sharp-shaped runtime junction with ${mode}`, async (t) => {
    const { workspace, output } = await sharpLink(t, mode);
    await assert.rejects(
      auditProductionOutput(output, workspace),
      /Unexpected link/,
    );
  });
}
test("an allowed Sharp runtime cannot carry captured fonts or nested links", async (t) => {
  const { workspace, output, target } = await sharpLink(t);
  await writeFile(join(target, "capture.woff2"), "unqualified font");
  assert.match(
    (await auditProductionOutput(output, workspace)).issues.join("\n"),
    /Unqualified font/,
  );
  const privateTarget = join(workspace, ".local/archive");
  await mkdir(privateTarget, { recursive: true });
  await symlink(privateTarget, join(target, "nested"), "junction");
  await assert.rejects(
    auditProductionOutput(output, workspace),
    /Unexpected link/,
  );
});
