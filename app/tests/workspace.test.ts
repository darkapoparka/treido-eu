import { readFileSync, existsSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
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

it("keeps the owning documents' relative file links resolvable", () => {
  for (const file of [
    "README.md",
    "AGENTS.md",
    "tasks.md",
    "product.md",
    "design.md",
    "techstack.md",
    "architecture.md",
    "verification.md",
  ]) {
    const contents = readFileSync(resolve(root, file), "utf8");
    for (const match of contents.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1];
      if (/^(https?:|#)/.test(target)) continue;
      expect(
        existsSync(resolve(root, target.split("#")[0])),
        `${file}: ${target}`,
      ).toBe(true);
    }
  }
});
