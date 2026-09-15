import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  import.meta.dirname,
  "..",
  "drizzle",
  "0012_counterparty-status.sql",
);

describe("миграция статусов контрагентов", () => {
  it("меняет только таблицу контрагентов и задаёт безопасное значение по умолчанию", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain("ALTER TABLE `counterparties`");
    expect(migration).toContain("ADD `status` enum('normal','missing_scans','blacklisted','debtor')");
    expect(migration).toContain("NOT NULL DEFAULT 'normal'");
    expect(migration).not.toContain("CREATE TABLE");
  });
});
