import type { Entry, Inflight } from "./entry";
import { type RetryDeps, withRetry } from "./retry";

export interface FetchContext {
  signal: AbortSignal;
}

export interface FetchDeps<K, T> extends RetryDeps {
  load: (key: K, context: FetchContext) => Promise<T>;
  onFailure: (entry: Entry<K, T>, error: unknown, permanent: boolean) => void;
  onSuccess: (entry: Entry<K, T>, data: T) => void;
}

function contextOf(inflight: Inflight): FetchContext {
  return {
    get signal() {
      inflight.consumed = true;
      return inflight.controller.signal;
    },
  };
}

export async function runFetch<K, T>(
  deps: FetchDeps<K, T>,
  entry: Entry<K, T>,
  inflight: Inflight,
): Promise<void> {
  const outcome = await withRetry(
    deps,
    () => deps.load(entry.key, contextOf(inflight)),
    inflight.controller.signal,
  );
  if (!outcome || entry.inflight !== inflight) return;
  if ("data" in outcome) deps.onSuccess(entry, outcome.data);
  else deps.onFailure(entry, outcome.error, outcome.permanent);
}

export function createRequests(deps: RetryDeps) {
  let session = new AbortController();

  return {
    abort: () => {
      session.abort();
      session = new AbortController();
    },
    run: async <R>(load: (context: FetchContext) => Promise<R>): Promise<R | undefined> => {
      const { signal } = session;
      const outcome = await withRetry(deps, () => load({ signal }), signal);
      if (outcome && "error" in outcome) throw outcome.error;
      return outcome?.data;
    },
  };
}
