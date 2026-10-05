import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  declarationKeys,
  headingAnchors,
  inside,
  linksIn,
  localTarget,
  stripFences,
  validateTasks,
} from "./check-product-docs.mjs";

const root = path.resolve("virtual-doc-root");
const queue = (rows, headings = "") =>
  `# Tasks\n${headings}\n## Executable work packages\n\n| ID | State | Prerequisites |\n|---|---|---|\n${rows}\n`;

test("fenced examples do not become file links or headings", () => {
  const source = "# Real\n```md\n[bad](missing.md)\n# Fake\n```\n[good](ok.md)";
  assert.deepEqual(linksIn(source), ["ok.md"]);
  assert.deepEqual([...headingAnchors(source)], ["real"]);
});

test("long and tilde fences retain their own closing delimiter", () => {
  assert.equal(stripFences("~~~~\na\n```\nb\n~~~~\nc").trim(), "c");
});

test("inline and reference-definition destinations are extracted", () => {
  assert.deepEqual(linksIn('[A](a.md#b "title")\n[B]: <docs/a file.md>'), [
    "a.md#b",
    "docs/a file.md",
  ]);
});

test("anchors support Unicode, duplicate headings and explicit HTML IDs", () => {
  const found = headingAnchors(
    '# Добре дошъл!\n## Same\n## Same\n<a id="browse-scope"></a>',
  );
  assert.deepEqual(
    [...found],
    ["добре-дошъл", "same", "same-1", "browse-scope"],
  );
});

test("relative and same-file links resolve inside the repo", () => {
  assert.deepEqual(localTarget(root, "docs/guide.md", "../AGENTS.md#rules"), {
    target: path.join(root, "AGENTS.md"),
    anchor: "rules",
  });
  assert.equal(
    localTarget(root, "docs/guide.md", "#a").target,
    path.join(root, "docs/guide.md"),
  );
});

test("external URLs are not fetched or interpreted as filesystem targets", () => {
  assert.equal(localTarget(root, "README.md", "https://example.com/a#b"), null);
  assert.equal(localTarget(root, "README.md", "mailto:team@example.com"), null);
});

test("traversal, encoded traversal, drive and file URLs are rejected", () => {
  for (const href of [
    "../outside.md",
    "%2e%2e/outside.md",
    "C:/private.md",
    "file:///private.md",
    "/outside.md",
  ]) {
    assert.throws(() => localTarget(root, "README.md", href));
  }
  assert.equal(inside(root, `${root}-other/file.md`), false);
});

test("local QA links fail before filesystem lookup in both local and clean checkouts", () => {
  for (const href of [
    ".qa/receipt.md",
    "%2eqa/receipt.md",
    "docs/../.qa/receipt.md#result",
    "app/apps/web/.qa/result.md",
  ]) {
    assert.throws(
      () => localTarget(root, "README.md", href),
      /local QA evidence/,
    );
  }
  assert.throws(
    () => localTarget(root, "docs/guide.md", "../.qa/receipt.md"),
    /local QA evidence/,
  );
  assert.equal(
    localTarget(root, "README.md", "docs/audit/review.md").target,
    path.join(root, "docs/audit/review.md"),
  );
});

test("malformed percent encoding fails rather than bypassing validation", () => {
  assert.throws(() => localTarget(root, "README.md", "%ZZ.md"), URIError);
});

test("completed combined receipt headings define historical prerequisites", () => {
  const result = validateTasks(
    queue("| T05a | DONE | T03a |", "## Receipt — T01 / T03a"),
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows.length, 1);
});

test("duplicate executable IDs fail", () => {
  assert.match(
    validateTasks(queue("| T01 | DONE | |\n| T01 | DONE | |")).errors.join(
      "\n",
    ),
    /Duplicate/,
  );
});

test("invalid states and unknown prerequisites fail", () => {
  const errors = validateTasks(queue("| T01 | PERFECT | T404 |")).errors.join(
    "\n",
  );
  assert.match(errors, /Invalid task state/);
  assert.match(errors, /Unknown prerequisite/);
});

test("dependency cycles fail", () => {
  assert.match(
    validateTasks(
      queue("| T01 | TODO | T02 |\n| T02 | TODO | T01 |"),
    ).errors.join("\n"),
    /Task cycle/,
  );
});

test("missing executable table fails closed", () => {
  assert.match(
    validateTasks("# Tasks\nNothing here").errors.join("\n"),
    /Missing executable/,
  );
});

test("historical task rows do not create duplicate executable IDs", () => {
  assert.deepEqual(
    validateTasks(
      queue("| T01 | DONE | |", "## Ordered work\n| T01 | DONE | |"),
    ).errors,
    [],
  );
});

test("declaration comparison ignores ordering but detects pin drift", () => {
  const a = {
    manifest: "app/package.json",
    section: "devDependencies",
    name: "x",
    pin: "1.0.0",
  };
  const b = { ...a, name: "y" };
  assert.deepEqual(declarationKeys([a, b]), declarationKeys([b, a]));
  assert.notDeepEqual(
    declarationKeys([a]),
    declarationKeys([{ ...a, pin: "2.0.0" }]),
  );
});
