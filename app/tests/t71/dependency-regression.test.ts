import { spawnSync } from "node:child_process";
import {
  closeSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  statSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

// Resolve exactly as Expo Router does, rather than testing a hoisted/test-only copy.
const workspace = resolve(import.meta.dirname, "../..");
const mobile = createRequire(resolve(workspace, "apps/mobile/package.json"));
const routerEntry = mobile.resolve("expo-router");
const router = createRequire(routerEntry);
const queryEntry = router.resolve("query-string");
const queryRequire = createRequire(queryEntry);
const decoderEntry = queryRequire.resolve("decode-uri-component");
type QueryValue = string | string[] | null;
type ArrayOptions = { arrayFormat: "bracket" | "index" | "comma" };
const query = router("query-string") as {
  parse(input: string, options?: ArrayOptions): Record<string, QueryValue>;
  stringify(input: Record<string, QueryValue>, options?: ArrayOptions): string;
};

describe("T71 Expo Router query-string decoder compatibility", () => {
  it("keeps query-string 7.1.3 and selects upstream 0.5.0's ESM default", async () => {
    const queryPackage = queryRequire("./package.json") as { version: string };
    const decoderPackage = JSON.parse(
      readFileSync(resolve(dirname(decoderEntry), "package.json"), "utf8"),
    ) as { version: string; type: string };
    expect(queryPackage.version).toBe("7.1.3");
    expect(decoderPackage).toMatchObject({ version: "0.5.0", type: "module" });
    const required = queryRequire("decode-uri-component") as {
      default: (value: string) => string;
    };
    const imported = (await import(pathToFileURL(decoderEntry).href)) as {
      default: (value: string) => string;
    };
    expect(typeof required).toBe("object");
    expect(typeof required.default).toBe("function");
    expect(required.default).toBe(imported.default);
    expect(required.default("%D0%91%D0%93%F0%9F%9A%97")).toBe("БГ🚗");
    expect(query.parse("q=%D0%91%D0%93%F0%9F%9A%97")).toEqual({ q: "БГ🚗" });
  });

  it("decodes Bulgarian keys/values, Unicode and emoji without changing stringify", () => {
    const values = { град: "София", q: "Кафе ☕ 🚗", unicode: "日本語 é" };
    const encoded = query.stringify(values);
    expect(encoded).toBe(
      "q=%D0%9A%D0%B0%D1%84%D0%B5%20%E2%98%95%20%F0%9F%9A%97&unicode=%E6%97%A5%E6%9C%AC%E8%AA%9E%20%C3%A9&%D0%B3%D1%80%D0%B0%D0%B4=%D0%A1%D0%BE%D1%84%D0%B8%D1%8F",
    );
    expect(query.parse(encoded)).toEqual(values);
    expect(Object.getPrototypeOf(query.parse(encoded))).toBeNull();
  });

  it("retains plus-as-space, encoded literal plus, repeated keys and null/empty values", () => {
    expect(
      query.parse("q=София+център&literal=%2B&tag=ново&tag=🚗&flag&empty="),
    ).toEqual({
      q: "София център",
      literal: "+",
      tag: ["ново", "🚗"],
      flag: null,
      empty: "",
    });
    expect(
      query.stringify({
        q: "a+b c",
        tag: ["ново", "🚗"],
        flag: null,
        empty: "",
      }),
    ).toBe(
      "empty=&flag&q=a%2Bb%20c&tag=%D0%BD%D0%BE%D0%B2%D0%BE&tag=%F0%9F%9A%97",
    );
  });

  it("parses a deep-link query through Expo Router's installed path consumer", () => {
    const linking = router("./react-navigation/core/getStateFromPath") as {
      getStateFromPath(
        path: string,
        options: { screens: Record<string, string> },
      ): { routes: { name: string; params: Record<string, QueryValue> }[] };
    };
    const values = { q: ["София", "🚗"], literal: "a+b c" };
    const state = linking.getStateFromPath(
      `/search?${query.stringify(values)}`,
      { screens: { Search: "search" } },
    );
    expect(state.routes[0]).toMatchObject({ name: "Search", params: values });
  });

  it.each(["bracket", "index", "comma"] as const)(
    "retains the %s array parse/stringify contract",
    (arrayFormat) => {
      const values = { tag: ["БГ", "🚗"], q: "a+b c" };
      const encoded = query.stringify(values, { arrayFormat });
      expect(query.parse(encoded, { arrayFormat })).toEqual(values);
    },
  );

  it.each([
    ["%EA", "%EA"],
    ["%E0%A4%A", "%E0%A4%A"],
    ["%C0%AF", "%C0%AF"],
    ["%ED%A0%80", "%ED%A0%80"],
    ["%F4%90%80%80", "%F4%90%80%80"],
    ["%FE%FF", "��"],
    ["%C2", "�"],
    ["%G1%", "%G1%"],
    ["%EA%D0%91%D0%93%F0%9F%9A%97", "%EAБГ🚗"],
  ])(
    "tolerates malformed UTF-8 %s while decoding valid subsequences",
    (input, output) => {
      expect(query.parse(`q=${input}`)).toEqual({ q: output });
    },
  );

  it("bounds malformed-percent CPU regression in a disposable child process", () => {
    // GHSA-vcc3-ghjq-m6fr: one finite ~24 KiB malformed value, no main-thread decode.
    // The old decoder recurses/retries; upstream 0.5.0 scans invalid runs in O(n).
    const evidence = resolve(
      workspace,
      "../.qa/t71/dependency-repair/children",
    );
    mkdirSync(evidence, { recursive: true });
    const run = mkdtempSync(resolve(evidence, "percent-cpu-"));
    const outputPath = resolve(run, "child.log");
    const output = openSync(outputPath, "w");
    // File-backed output also works inside Windows sandboxes that deny anonymous pipes.
    let child;
    try {
      child = spawnSync(
        process.execPath,
        [
          "--input-type=commonjs",
          "--eval",
          `const assert = require('node:assert/strict');
         const query = require(process.argv[1]);
         const malformed = '%EA'.repeat(8192);
         const parsed = query.parse('q=' + malformed + '%D0%91%D0%93%F0%9F%9A%97');
         assert.equal(parsed.q, malformed + 'БГ🚗');
         assert.equal(query.parse('q=%EA').q, '%EA');
         console.log(JSON.stringify({tokens: 8192, recovered: true}));`,
          queryEntry,
        ],
        {
          stdio: ["ignore", output, output],
          timeout: 5000,
          killSignal: "SIGKILL",
        },
      );
    } finally {
      closeSync(output);
    }
    expect(child.error).toBeUndefined();
    expect(child.signal).toBeNull();
    expect(statSync(outputPath).size).toBeLessThan(64 * 1024);
    const log = readFileSync(outputPath, "utf8");
    expect(child.status, log).toBe(0);
    expect(JSON.parse(log)).toEqual({ tokens: 8192, recovered: true });
  }, 10000);
});
