import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openDb, id } from "../src/db.js";
import { backupDatabase } from "../src/backup.js";

test("persisted accounts survive reopening and backup is a restorable SQLite snapshot with uploads", () => {
  const dir = mkdtempSync(resolve(tmpdir(), "virtus-backup-test-"));
  const source = resolve(dir, "store.sqlite"),
    target = resolve(dir, "backup");
  let db = openDb(source);
  db.prepare(
    "INSERT INTO mg_accounts(id,name,scope,opening) VALUES(?,?,?,?)",
  ).run(id(), "Caja persistente", "business", 12345);
  db.close();
  db = openDb(source);
  assert.equal(
    db.prepare("SELECT opening FROM mg_accounts").get().opening,
    12345,
  );
  mkdirSync(resolve(dir, "uploads"));
  writeFileSync(resolve(dir, "uploads", "sample.txt"), "fixture");
  backupDatabase(source, target);
  db.close();
  const restored = new DatabaseSync(resolve(target, "store.sqlite"));
  assert.equal(
    restored.prepare("PRAGMA integrity_check").get().integrity_check,
    "ok",
  );
  assert.equal(
    restored.prepare("SELECT opening FROM mg_accounts").get().opening,
    12345,
  );
  restored.close();
  assert.equal(
    readFileSync(resolve(target, "uploads", "sample.txt"), "utf8"),
    "fixture",
  );
});
