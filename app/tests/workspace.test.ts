import { readFileSync, existsSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const web = createRequire(resolve(root, "apps/web/package.json"));
const mobile = createRequire(resolve(root, "apps/mobile/package.json"));

describe("workspace resolution", () => {
  it("resolves one compatible React instance for both clients and renderers", () => {
    const reactPath = realpathSync(web.resolve("react"));
    expect(realpathSync(mobile.resolve("react"))).toBe(reactPath);
    for (const renderer of [
      web.resolve("react-dom"),
      mobile.resolve("react-native"),
    ]) {
      expect(realpathSync(createRequire(renderer).resolve("react"))).toBe(
        reactPath,
      );
    }
  });

  it("resolves the same explicit shared contract from both applications", () => {
    expect(realpathSync(web.resolve("@treido/contracts"))).toBe(
      realpathSync(mobile.resolve("@treido/contracts")),
    );
  });

  it("resolves one copy of each installed native module from Router", () => {
    const router = createRequire(mobile.resolve("expo-router"));
    for (const name of [
      "react-native",
      "react-native-screens",
      "react-native-safe-area-context",
    ]) {
      expect(realpathSync(router.resolve(name))).toBe(
        realpathSync(mobile.resolve(name)),
      );
    }
  });
});

it("keeps the product documents' relative file links inside the repository and resolvable", () => {
  const productRoot = resolve(root, "..");
  for (const file of [
    "README.md",
    "AGENTS.md",
    "tasks.md",
    "prd.md",
    "styling.md",
    "techstack.md",
    "architecture.md",
    "docs/testing.md",
  ]) {
    const owner = resolve(productRoot, file);
    const contents = readFileSync(owner, "utf8");
    for (const match of contents.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1];
      if (/^(?:[a-z][a-z\d+.-]*:|#)/i.test(target)) continue;
      const destination = resolve(dirname(owner), target.split("#")[0]);
      const path = relative(productRoot, destination);
      expect(isAbsolute(path), `${file}: ${target}`).toBe(false);
      expect(
        path === ".." || path.startsWith(`..${sep}`),
        `${file}: ${target}`,
      ).toBe(false);
      expect(existsSync(destination), `${file}: ${target}`).toBe(true);
    }
  }
});
