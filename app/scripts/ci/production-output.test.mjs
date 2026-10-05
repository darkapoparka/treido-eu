import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  rm,
  readFile,
  writeFile,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, parse, relative, resolve } from "node:path";
import test from "node:test";
import { URL } from "node:url";
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
    (root) => join(root, "apps/web/public/reference-live/preferences/man.png"),
  ]);
  const result = await auditProductionOutput(output, workspace);
  assert.equal(
    result.issues.filter((issue) => issue.includes("Private reference")).length,
    3,
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

async function merchantFont(t, mode = "valid") {
  const { workspace, output } = await fixture(t);
  const directory = join(
    output,
    mode === "wrong-location"
      ? "output/static/fonts/unreviewed"
      : "output/static/fonts/admin",
  );
  await mkdir(directory, { recursive: true });
  const source = new URL("../../apps/web/public/fonts/admin/", import.meta.url);
  const font = await readFile(new URL("InterVariable.woff2", source));
  if (mode === "changed-font") font[0] ^= 1;
  await writeFile(join(directory, "InterVariable.woff2"), font);
  if (mode !== "missing-license") {
    await writeFile(
      join(directory, "OFL.txt"),
      mode === "changed-license"
        ? "unapproved license"
        : await readFile(new URL("OFL.txt", source)),
    );
  }
  return { workspace, output };
}

test("accepts only the reviewed merchant Inter bytes accompanied by the upstream OFL", async (t) => {
  const { workspace, output } = await merchantFont(t);
  assert.deepEqual(await auditProductionOutput(output, workspace), {
    tracesChecked: 1,
    issues: [],
  });
});

for (const mode of [
  "changed-font",
  "missing-license",
  "changed-license",
  "wrong-location",
]) {
  test(`rejects merchant font publication with ${mode}`, async (t) => {
    const { workspace, output } = await merchantFont(t, mode);
    assert.match(
      (await auditProductionOutput(output, workspace)).issues.join("\n"),
      /Unqualified font/,
    );
  });
}

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

async function hostedFunctionLink(t, mode = "valid") {
  const { workspace, output } = await fixture(t);
  const functions = join(output, "output/functions");
  const target =
    mode === "escaped"
      ? join((await fixture(t)).workspace, "outside.func")
      : mode === "private"
        ? join(functions, ".local/shared.func")
        : mode === "outside-functions"
          ? join(output, "server/shared.func")
          : join(functions, "shared.func");
  await mkdir(target, { recursive: true });
  const alias =
    mode === "nested"
      ? join(target, "nested.func")
      : join(functions, "route.segments/__PAGE__.segment.rsc.func");
  await mkdir(dirname(alias), { recursive: true });
  await symlink(target, alias, "junction");
  await writeFile(
    join(target, "handler.js.nft.json"),
    JSON.stringify({ files: [] }),
  );
  return { workspace, output, target };
}

test("audits each generated Vercel function once through bounded route aliases", async (t) => {
  const { workspace, output } = await hostedFunctionLink(t);
  assert.deepEqual(await auditProductionOutput(output, workspace), {
    tracesChecked: 2,
    issues: [],
  });
});

for (const mode of ["escaped", "private", "outside-functions", "nested"]) {
  test(`rejects a generated function alias with ${mode}`, async (t) => {
    const { workspace, output } = await hostedFunctionLink(t, mode);
    await assert.rejects(
      auditProductionOutput(output, workspace),
      /Unexpected link/,
    );
  });
}

test("function aliases cannot conceal captured media or private dependency traces", async (t) => {
  const { workspace, output, target } = await hostedFunctionLink(t);
  await writeFile(join(target, "capture.woff2"), "unqualified font");
  await writeFile(
    join(target, "handler.js.nft.json"),
    JSON.stringify({
      files: [relative(target, join(workspace, ".local/archive.png"))],
    }),
  );
  const result = await auditProductionOutput(output, workspace);
  assert.equal(result.issues.length, 2);
  assert.match(result.issues.join("\n"), /Unqualified font/);
  assert.match(result.issues.join("\n"), /Private reference dependency/);
});

test("function aliases still reject unreviewed nested runtime links", async (t) => {
  const { workspace, output, target } = await hostedFunctionLink(t);
  const privateTarget = join(workspace, ".local/archive");
  await mkdir(privateTarget, { recursive: true });
  await symlink(privateTarget, join(target, "runtime"), "junction");
  await assert.rejects(
    auditProductionOutput(output, workspace),
    /Unexpected link/,
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

async function inngestLink(t, mode = "valid") {
  const { workspace, output } = await fixture(t);
  const target = join(
    workspace,
    "node_modules/.pnpm/inngest@4.21.0_peer_fixture/node_modules/inngest",
  );
  const alternate =
    mode === "escaped"
      ? join((await fixture(t)).workspace, "inngest")
      : mode === "private"
        ? join(workspace, ".local/inngest")
        : mode === "wrong-store"
          ? join(workspace, "packages/inngest")
          : mode === "wrong-store-version"
            ? join(
                workspace,
                "node_modules/.pnpm/inngest@4.20.0_peer_fixture/node_modules/inngest",
              )
            : mode === "different-importer"
              ? join(
                  workspace,
                  "node_modules/.pnpm/inngest@4.21.0_other_peers/node_modules/inngest",
                )
              : target;
  for (const directory of new Set([target, alternate])) {
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, "package.json"),
      JSON.stringify({
        name: mode === "wrong-name" ? "unreviewed" : "inngest",
        version: mode === "wrong-version" ? "4.20.0" : "4.21.0",
      }),
    );
  }
  await writeFile(
    join(workspace, "apps/web/package.json"),
    JSON.stringify({
      dependencies:
        mode === "undeclared"
          ? {}
          : {
              inngest: mode === "unpinned" ? "^4.21.0" : "4.21.0",
            },
    }),
  );
  const importer = join(workspace, "apps/web/node_modules");
  await mkdir(importer, { recursive: true });
  await symlink(
    mode === "different-importer" ? target : alternate,
    join(importer, "inngest"),
    "junction",
  );
  const outputModules = join(output, "node_modules");
  await mkdir(outputModules, { recursive: true });
  await symlink(
    alternate,
    join(
      outputModules,
      mode === "other-link" ? "inngest-custom" : "inngest-71afd24a7f197285",
    ),
    "junction",
  );
  return { workspace, output, target };
}

test("accepts only the pinned Inngest runtime used by the actual web importer", async (t) => {
  const { workspace, output } = await inngestLink(t);
  assert.deepEqual(await auditProductionOutput(output, workspace), {
    tracesChecked: 1,
    issues: [],
  });
});

for (const mode of [
  "undeclared",
  "unpinned",
  "wrong-version",
  "wrong-name",
  "escaped",
  "private",
  "wrong-store",
  "wrong-store-version",
  "different-importer",
  "other-link",
]) {
  test(`rejects an Inngest-shaped runtime link with ${mode}`, async (t) => {
    const { workspace, output } = await inngestLink(t, mode);
    await assert.rejects(
      auditProductionOutput(output, workspace),
      /Unexpected link/,
    );
  });
}

test("an allowed Inngest runtime cannot conceal private media, traces or nested links", async (t) => {
  const { workspace, output, target } = await inngestLink(t);
  await writeFile(join(target, "capture.woff2"), "unqualified font");
  await writeFile(
    join(target, "runtime.js.nft.json"),
    JSON.stringify({
      files: [relative(target, join(workspace, ".local/archive.png"))],
    }),
  );
  const result = await auditProductionOutput(output, workspace);
  assert.match(result.issues.join("\n"), /Unqualified font/);
  assert.match(result.issues.join("\n"), /Private reference dependency/);
  const privateTarget = join(workspace, ".local/archive");
  await mkdir(privateTarget, { recursive: true });
  await symlink(privateTarget, join(target, "nested"), "junction");
  await assert.rejects(
    auditProductionOutput(output, workspace),
    /Unexpected link/,
  );
});
