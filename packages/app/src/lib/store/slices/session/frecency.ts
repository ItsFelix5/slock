// A small frequency+recency ("frecency") usage tracker, persisted to
// localStorage — the same local-usage-database approach the real client uses
// (for its quick-switcher jump list, its emoji picker, etc.), seeded on top of
// the account's *real* usage history pulled from users.prefs.get (see
// fetchUserPrefs) so ranking isn't cold on a fresh browser/profile.
const FRECENCY_HALF_LIFE_MS = 3 * 24 * 60 * 60 * 1000;

export function decayScore(count: number, lastTs: number): number {
  return count * 0.5 ** ((Date.now() - lastTs) / FRECENCY_HALF_LIFE_MS);
}

export function createFrecencyTracker(storageKey: string) {
  const load = (): Record<string, { count: number; lastTs: number }> => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? "{}");
    } catch {
      return {};
    }
  };
  const data = load();
  return {
    record(id: string) {
      const entry = data[id];
      data[id] = { count: (entry?.count ?? 0) + 1, lastTs: Date.now() };
      localStorage.setItem(storageKey, JSON.stringify(data));
    },
    score(id: string): number {
      const entry = data[id];
      return entry ? decayScore(entry.count, entry.lastTs) : 0;
    },
  };
}
