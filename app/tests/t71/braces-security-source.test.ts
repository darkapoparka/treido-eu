import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  memoryRequire,
  packageRoot,
  sourcePackage,
} from "./security-source-loader";

type Ast = { type: string; nodes?: Ast[]; value?: string; parent?: Ast };
type Options = Record<string, unknown>;
type Braces = {
  (input: string | string[], options?: Options): string[];
  parse(input: string, options?: Options): Ast;
  compile(input: string | Ast, options?: Options): string;
  stringify(input: string | Ast, options?: Options): string;
  expand(input: string | Ast, options?: Options): string[];
};
const originalSource = sourcePackage("braces", "3.0.3", false);
const patchedSource = sourcePackage("braces", "3.0.3", true);
const original = memoryRequire([originalSource])(
  resolve(originalSource.root, "index.js"),
) as Braces;
const patched = memoryRequire([patchedSource])(
  resolve(patchedSource.root, "index.js"),
) as Braces;
const methods = ["compile", "expand", "stringify"] as const;
function chain(depth: number): Ast {
  let ast: Ast = { type: "text", value: "synthetic" };
  for (let i = 0; i < depth; i++) ast = { type: "root", nodes: [ast] };
  return ast;
}

describe("T02b braces source mitigation", () => {
  it("proves original deep-pattern acceptance and direct-AST stack exhaustion, then rejects before recursion", () => {
    const input = `${"{".repeat(4000)}a,b${"}".repeat(4000)}`;
    expect(input.length).toBeLessThan(10000);
    const ast = original.parse(input);
    // Parsing accepts all 4,000 nested blocks without a depth guard. Do not
    // require recursive compilation of that AST to fit every worker stack;
    // the independent direct-AST assertion below proves stack exhaustion.
    let block = ast;
    let depth = 0;
    for (;;) {
      const next = block.nodes?.find((node) => node.type === "brace");
      if (!next) break;
      depth++;
      block = next;
    }
    expect(depth).toBe(4000);
    expect(() => original.compile(chain(50000))).toThrow(/call stack/i);
    expect(() => patched(input)).toThrow(/Braces safety limit: pattern depth/);
    expect(() => patched.compile(ast)).toThrow(
      /Braces safety limit: AST depth/,
    );
  });

  it.each(["brace", "paren", "mixed"])(
    "bounds parsed %s depth at every public entry",
    (kind) => {
      const [open, close] =
        kind === "brace"
          ? ["{", "}"]
          : kind === "paren"
            ? ["(", ")"]
            : ["({", "})"];
      const input = `${open.repeat(101)}a,b${close.repeat(101)}`;
      for (const method of ["parse", ...methods] as const) {
        for (const maxDepth of [undefined, Infinity, 1000000, false]) {
          expect(() => patched[method](input, { maxDepth })).toThrow(
            /pattern depth/,
          );
        }
      }
    },
  );

  it.each(methods)(
    "bounds directly supplied %s ASTs and its internal module API",
    (method) => {
      const load = memoryRequire([patchedSource]);
      const internal = load(
        resolve(patchedSource.root, `lib/${method}.js`),
      ) as (ast: Ast) => unknown;
      for (const run of [(ast: Ast) => patched[method](ast), internal]) {
        expect(() => run(chain(10000))).toThrow(/AST depth/);
        const cyclic: Ast = { type: "root", nodes: [] };
        cyclic.nodes!.push(cyclic);
        expect(() => run(cyclic)).toThrow(/AST child cycle/);
        expect(() =>
          run({
            type: "root",
            nodes: Array.from({ length: 20004 }, () => ({
              type: "text",
              value: "x",
            })),
          }),
        ).toThrow(/AST node visits/);
        // A DAG is allowed, but counting repeated visits prevents exponential work.
        let shared: Ast = { type: "text", value: "x" };
        for (let i = 0; i < 15; i++)
          shared = { type: "root", nodes: [shared, shared] };
        expect(() => run(shared)).toThrow(/AST node visits/);
      }
    },
  );

  it("accepts ordinary parent/prev back-references, shared leaves and parsed depth 100", () => {
    const input = `${"{".repeat(100)}a,b${"}".repeat(100)}`;
    expect(patched.compile(input)).toBe(original.compile(input));
    expect(patched.stringify(input)).toBe(original.stringify(input));
    const ast = patched.parse("x/{a,b}/y");
    const brace = ast.nodes!.find((node) => node.type === "brace")!;
    expect(brace.parent).toBe(ast);
    expect(patched.stringify(brace)).toBe("{a,b}");
    expect(patched.expand(ast)).toEqual(["x/a/y", "x/b/y"]);
    const leaf = { type: "text", value: "x" };
    expect(patched.stringify({ type: "root", nodes: [leaf, leaf] })).toBe("xx");
  });

  it("bounds expansion's independent parent lookup without rejecting normal back-references", () => {
    const paren: Ast = { type: "paren", nodes: [] };
    paren.parent = paren;
    expect(() => patched.expand({ type: "root", nodes: [paren] })).toThrow(
      /parent depth or cycle/,
    );
  });

  it.each([
    "src/{a,b}/{01..03}.ts",
    "{5..1..2}",
    "{a..e..2}",
    "{a,{b,c}}",
    "a/\\{literal\\}/b",
    "@(a|b)/{x,y}",
    "!(foo|bar)/{1..3}",
    "[{}()]/x",
    '"{{literal}}"',
    "${a,b}",
    "a/{broken",
    "{}",
  ])("preserves normal compile/expand/stringify for %s", (input) => {
    for (const method of methods)
      expect(patched[method](input)).toEqual(original[method](input));
    expect(patched(input)).toEqual(original(input));
  });

  it("does not count escaped, quoted or bracketed delimiters as nested blocks", () => {
    for (const input of [
      "\\{".repeat(1000),
      `"${"{".repeat(1000)}"`,
      `[${"{".repeat(1000)}]`,
    ]) {
      expect(patched.compile(input)).toBe(original.compile(input));
    }
  });

  it("preserves the 3.0.3 character cap and caller's stricter maxLength/rangeLimit", () => {
    expect(() =>
      patched.parse("a".repeat(10001), { maxLength: Infinity }),
    ).toThrow(/max characters \(10000\)/);
    expect(() => patched.parse("abcd", { maxLength: 3 })).toThrow(
      /max characters \(3\)/,
    );
    expect(() => patched.expand("{1..1001}")).toThrow(/range limit/);
    expect(() => patched.expand("{1..4}", { rangeLimit: 3 })).toThrow(
      /range limit/,
    );
    expect(patched.expand("{1..1000}")).toEqual(original.expand("{1..1000}"));
    expect(patched.expand("{1..9..2}", { rangeLimit: false })).toEqual([
      "1",
      "3",
      "5",
      "7",
      "9",
    ]);
  });

  it("bounds ranges, Cartesian products and output characters even with disabled/raised caller limits", () => {
    for (const rangeLimit of [false, Infinity, 10000000000]) {
      for (const input of ["{0..1000000000}", "{1000000000..0}"]) {
        expect(() => patched.expand(input, { rangeLimit })).toThrow(
          /expansion count/,
        );
      }
    }
    expect(() => patched.expand("{a,b}".repeat(14))).toThrow(/expansion count/);
    expect(patched.expand("{a,b}".repeat(10))).toHaveLength(1024);
    expect(() =>
      patched.expand({
        type: "root",
        nodes: [{ type: "text", value: "x".repeat(1000001) }],
      }),
    ).toThrow(/expansion characters/);
  });

  it("retains real micromatch and fast-glob consumer behavior in memory", () => {
    const micromatchRoot = packageRoot("micromatch", "4.0.8");
    const globRoot = packageRoot("fast-glob", "3.3.1");
    const load = memoryRequire([
      patchedSource,
      { root: micromatchRoot, sources: new Map() },
      { root: globRoot, sources: new Map() },
    ]);
    const mm = load(resolve(micromatchRoot, "index.js")) as {
      (files: string[], patterns: string): string[];
      braces(input: string): string[];
    };
    const glob = load(resolve(globRoot, "out/index.js")) as {
      sync(pattern: string, options: Options): string[];
    };
    expect(mm(["src/a.ts", "src/b.ts", "src/c.ts"], "src/{a,b}.ts")).toEqual([
      "src/a.ts",
      "src/b.ts",
    ]);
    expect(
      mm(["src/a.ts", "src/b.js", "src/c.ts"], "src/@(a|b).{ts,js}"),
    ).toEqual(["src/a.ts", "src/b.js"]);
    expect(() => mm.braces(`${"{".repeat(101)}a,b${"}".repeat(101)}`)).toThrow(
      /pattern depth/,
    );
    expect(
      glob
        .sync("tests/t71/{braces,forge}-security-source.test.ts", {
          cwd: resolve(import.meta.dirname, "../.."),
          onlyFiles: true,
        })
        .sort(),
    ).toEqual([
      "tests/t71/braces-security-source.test.ts",
      "tests/t71/forge-security-source.test.ts",
    ]);
  });
});

describe("T02b braces installed-consumer mitigation", () => {
  it("uses the patched braces from actual installed fast-glob/micromatch", () => {
    const globRoot = packageRoot("fast-glob", "3.3.1");
    const globRequire = createRequire(resolve(globRoot, "package.json"));
    const mmEntry = globRequire.resolve("micromatch");
    const mmRequire = createRequire(mmEntry);
    const braces = mmRequire("braces") as Braces;
    expect(mmRequire("braces/package.json").version).toBe("3.0.3");
    expect(() => braces.compile(chain(10000))).toThrow(/AST depth/);
    const mm = globRequire("micromatch") as { braces(input: string): string[] };
    expect(mm.braces("src/{a,b}.ts")).toEqual(["src/(a|b).ts"]);
    expect(() => mm.braces(`${"{".repeat(101)}a,b${"}".repeat(101)}`)).toThrow(
      /pattern depth/,
    );
    const glob = globRequire(resolve(globRoot, "out/index.js")) as {
      sync(pattern: string, options: Options): string[];
    };
    expect(
      glob.sync("tests/t71/{braces,forge}-security-source.test.ts", {
        cwd: resolve(import.meta.dirname, "../.."),
      }),
    ).toHaveLength(2);
  });
});
