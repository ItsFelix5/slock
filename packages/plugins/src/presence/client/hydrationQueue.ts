import type { UserId } from "@slock/types";

export function createHydrationQueue(opts: {
  load: (id: UserId) => Promise<unknown>;
  schedule: (run: () => void) => () => void;
}) {
  const hydrated = new Set<UserId>();
  const queued = new Set<UserId>();
  let scheduled = false;
  let cancel: (() => void) | undefined;

  function flush() {
    scheduled = false;
    const ids = [...queued];
    queued.clear();
    for (const id of ids) opts.load(id).catch(() => hydrated.delete(id));
  }

  return {
    dispose() {
      cancel?.();
    },
    request(ids: UserId[]) {
      for (const id of ids) {
        if (hydrated.has(id)) continue;
        hydrated.add(id);
        queued.add(id);
      }
      if (queued.size === 0 || scheduled) return;
      scheduled = true;
      cancel = opts.schedule(flush);
    },
  };
}
