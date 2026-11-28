import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const MEMORY = ":memory:";

export function openDatabase(path: string): Database {
  if (path !== MEMORY) mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { create: true, strict: true });
  db.run("PRAGMA journal_mode = WAL");
  db.run(
    "CREATE TABLE IF NOT EXISTS migrations (feature TEXT PRIMARY KEY, applied INTEGER NOT NULL)",
  );
  return db;
}

/**
 * Every feature owns its tables and lists its schema changes in order.
 * Steps already applied are skipped and a step is never edited after release, only appended.
 */
export function migrate(db: Database, feature: string, steps: string[]): void {
  const done =
    db
      .query<{ applied: number }, [string]>("SELECT applied FROM migrations WHERE feature = ?")
      .get(feature)?.applied ?? 0;
  if (done >= steps.length) return;
  db.transaction(() => {
    for (const step of steps.slice(done)) db.run(step);
    db.run("INSERT OR REPLACE INTO migrations (feature, applied) VALUES (?, ?)", [
      feature,
      steps.length,
    ]);
  })();
}
