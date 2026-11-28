import type { Database } from "bun:sqlite";
import type { Identity } from "../auth";
import { migrate } from "../db";

export const MAX_KEYS = 256;

type Row = { key: string; value: string };

export type SettingsStore = {
  all(who: Identity): Record<string, unknown>;
  set(who: Identity, key: string, value: string): "ok" | "too_many";
  remove(who: Identity, key: string): void;
};

/** Values are JSON text, validated by the caller, kept per Slack workspace and user. */
export function createSettingsStore(db: Database): SettingsStore {
  migrate(db, "settings", [
    `CREATE TABLE settings (
      team TEXT NOT NULL,
      user TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (team, user, key)
    ) WITHOUT ROWID`,
  ]);

  const list = db.query<Row, [string, string]>(
    "SELECT key, value FROM settings WHERE team = ? AND user = ?",
  );
  const has = db.query<object, [string, string, string]>(
    "SELECT 1 FROM settings WHERE team = ? AND user = ? AND key = ?",
  );
  const count = db.query<{ total: number }, [string, string]>(
    "SELECT count(*) AS total FROM settings WHERE team = ? AND user = ?",
  );
  const write = db.query<void, [string, string, string, string, number]>(
    `INSERT INTO settings (team, user, key, value, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (team, user, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  );
  const drop = db.query<void, [string, string, string]>(
    "DELETE FROM settings WHERE team = ? AND user = ? AND key = ?",
  );

  const insert = db.transaction((who: Identity, key: string, value: string) => {
    const isNew = !has.get(who.team, who.user, key);
    if (isNew && (count.get(who.team, who.user)?.total ?? 0) >= MAX_KEYS) return "too_many";
    write.run(who.team, who.user, key, value, Date.now());
    return "ok";
  });

  return {
    all: (who) =>
      Object.fromEntries(
        list.all(who.team, who.user).map(({ key, value }) => [key, JSON.parse(value)]),
      ),
    remove: (who, key) => void drop.run(who.team, who.user, key),
    set: (who, key, value) => insert(who, key, value),
  };
}
