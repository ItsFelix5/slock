import type { ResourceEnv } from "./delay";
import { type Entry, isInactive } from "./entry";

const FAILED_RETRY_MS = 30_000;
const FAILED_RETRY_CAP_MS = 300_000;

interface EntryTimerOptions<K, T> {
  discard: (entry: Entry<K, T>) => void;
  env: ResourceEnv;
  gcMs: number;
  maxAutoFailures: number;
  retry: (entry: Entry<K, T>) => void;
}

export function createEntryTimer<K, T>(options: EntryTimerOptions<K, T>) {
  const { env, gcMs } = options;

  const lifetimeOf = ({ box, error }: Entry<K, T>) =>
    error && !box ? Math.min(gcMs, FAILED_RETRY_MS) : gcMs;

  function revives(entry: Entry<K, T>) {
    const failed = entry.error && !entry.permanent && !entry.inflight;
    return failed && entry.listeners.size > 0 && entry.failures < options.maxAutoFailures;
  }

  function stop(entry: Entry<K, T>) {
    if (entry.timer !== undefined) env.clearTimeout(entry.timer);
    entry.timer = undefined;
  }

  function schedule(entry: Entry<K, T>) {
    stop(entry);
    const lifetime = lifetimeOf(entry);
    if (revives(entry)) {
      const wait = Math.min(FAILED_RETRY_MS * entry.failures, FAILED_RETRY_CAP_MS);
      entry.timer = env.setTimeout(() => options.retry(entry), wait);
    } else if (isInactive(entry) && Number.isFinite(lifetime))
      entry.timer = env.setTimeout(() => options.discard(entry), lifetime);
  }

  return { schedule, stop };
}
