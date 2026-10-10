import { describe, it, expect } from "vitest";
import { currentMigrationFiles } from "./current-migrations.mjs";
const names = ["0001_users.sql", "0002_sellers.sql", "0003_support.sql"];
const runner = (values) =>
  "for (const version of [" +
  values.map((value) => JSON.stringify(value.replace(/\.sql$/, ""))).join(",") +
  "]) {}";
describe("current schema registration", () => {
  it("requires every committed migration, including additions beyond a former checkpoint", () => {
    expect(
      currentMigrationFiles(
        [...names, "README.md"].reverse(),
        runner(names),
        3,
      ),
    ).toEqual(names);
    expect(() =>
      currentMigrationFiles(names, runner(names.slice(0, 2)), 2),
    ).toThrow("differs");
  });
  it("rejects missing, duplicate and unregistered migrations", () => {
    for (const files of [
      names.slice(1),
      [names[0], names[2]],
      [...names, names[2]],
    ])
      expect(() => currentMigrationFiles(files, runner(files), 2)).toThrow(
        "contiguous",
      );
    expect(() =>
      currentMigrationFiles(names, runner([...names, "0004_new.sql"]), 3),
    ).toThrow("differs");
  });
  it("does not execute expressions or accept dynamic runner entries", () => {
    for (const value of [
      '["0001_users", ...extra]',
      '["0001_users", makeVersion()]',
      '["0001_users"].concat(extra)',
    ])
      expect(() =>
        currentMigrationFiles(
          [names[0]],
          "for (const version of " + value + ") {}",
          1,
        ),
      ).toThrow("literal");
  });
  it("does not silently accept a schema older than the requested feature", () => {
    expect(() => currentMigrationFiles(names, runner(names), 4)).toThrow(
      "incomplete",
    );
  });
});
