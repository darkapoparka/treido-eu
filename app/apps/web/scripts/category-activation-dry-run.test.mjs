import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activationTarget,
  sourcePolicies,
  dryRunCategoryActivation,
} from "./category-activation-dry-run.mjs";

function packet() {
  return {
    target: { ...activationTarget },
    reviewReference: "owner-review-2026-10-06-case-17",
    policies: [
      {
        categoryId: "cat:fashion/tops-shirts",
        sellerKinds: ["personal"],
        conditions: ["good"],
        handoverModes: ["pickup"],
        purchaseModes: ["contact"],
      },
    ],
  };
}
test("reads actual immutable 152-leaf source and retains every restriction", () => {
  const source = sourcePolicies();
  assert.equal(source.rows.length, 152);
  const p = packet();
  p.policies[0].categoryId = "cat:electronics/phones";
  const result = dryRunCategoryActivation(p);
  assert.equal(result.mode, "dry-run-only");
  assert.equal(result.databaseVerified, false);
  assert.equal(result.reviewAuthenticityVerified, false);
  assert.deepEqual(
    result.proposals[0].rules.restrictions,
    source.rows[0].rules.restrictions,
  );
  assert.equal(result.proposals[0].expectedLatestVersion, 1);
  assert.equal(result.proposals[0].proposedVersion, 2);
  assert.deepEqual(dryRunCategoryActivation(p), result);
});
test("rejects foreign project, branch, country, application and database scopes", () => {
  for (const key of Object.keys(activationTarget)) {
    const p = packet();
    p.target[key] = "foreign";
    assert.throws(() => dryRunCategoryActivation(p), /Foreign/);
  }
});
test("rejects duplicate, root, unknown and unbounded category selections", () => {
  const p = packet();
  p.policies[0].categoryId = "cat:electronics/phones";
  p.policies.push(JSON.parse(JSON.stringify(p.policies[0])));
  assert.throws(() => dryRunCategoryActivation(p), /duplicate/);
  for (const id of ["cat:electronics", "foreign-leaf"]) {
    const q = packet();
    q.policies[0].categoryId = id;
    assert.throws(() => dryRunCategoryActivation(q), /Unknown/);
  }
  p.policies = Array(13).fill(p.policies[0]);
  assert.throws(() => dryRunCategoryActivation(p), /twelve/);
});
test("cannot turn on checkout, shipping, new conditions or seller kinds", () => {
  for (const [key, value] of [
    ["purchaseModes", ["checkout"]],
    ["handoverModes", ["shipping"]],
    ["conditions", ["refurbished"]],
    ["sellerKinds", ["staff"]],
  ]) {
    const p = packet();
    p.policies[0][key] = value;
    assert.throws(() => dryRunCategoryActivation(p), /Invalid/);
  }
});
test("rejects missing, fictional approval and arbitrary rule overrides", () => {
  for (const reference of [
    null,
    "TODO",
    "SYNTHETIC APPROVAL",
    "unapproved-reference",
  ]) {
    const p = packet();
    p.reviewReference = reference;
    assert.throws(() => dryRunCategoryActivation(p), /review reference/);
  }
  const p = packet();
  p.policies[0].restrictions = [];
  assert.throws(() => dryRunCategoryActivation(p), /fields/);
});
