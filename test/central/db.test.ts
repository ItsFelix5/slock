import { expect, test } from "bun:test";
import { migrate, openDatabase } from "../../packages/central/src/db";

const tables = (db: ReturnType<typeof openDatabase>) =>
  db
    .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE name LIKE 't_'")
    .all()
    .map((row) => row.name);

test("migrations run once and only the new steps run later", () => {
  const db = openDatabase(":memory:");
  migrate(db, "f", ["CREATE TABLE t1 (a)"]);
  migrate(db, "f", ["CREATE TABLE t1 (a)"]);
  migrate(db, "f", ["CREATE TABLE t1 (a)", "CREATE TABLE t2 (a)"]);
  expect(tables(db).sort()).toEqual(["t1", "t2"]);
});

test("features track their own migrations", () => {
  const db = openDatabase(":memory:");
  migrate(db, "one", ["CREATE TABLE t1 (a)"]);
  migrate(db, "two", ["CREATE TABLE t2 (a)"]);
  expect(tables(db).sort()).toEqual(["t1", "t2"]);
});

test("a failing step leaves nothing half applied", () => {
  const db = openDatabase(":memory:");
  expect(() => migrate(db, "f", ["CREATE TABLE t1 (a)", "NOT SQL"])).toThrow();
  expect(tables(db)).toEqual([]);
  migrate(db, "f", ["CREATE TABLE t1 (a)"]);
  expect(tables(db)).toEqual(["t1"]);
});
