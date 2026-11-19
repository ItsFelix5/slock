export interface LatestSyncOptions<T> {
  key: (value: T) => string;
  onError?: (value: T, error: unknown) => boolean | undefined;
  version: (value: T) => number;
  write: (value: T) => Promise<void>;
}

interface Pending<T> {
  revision: number;
  value: T;
}

interface SyncState<T> {
  desired?: Pending<T>;
  nextRevision: number;
  running?: Promise<boolean>;
  syncedRevision?: number;
  syncedVersion?: number;
}

export function createLatestValueSync<T>(options: LatestSyncOptions<T>) {
  const states = new Map<string, SyncState<T>>();

  const stateFor = (key: string) => {
    let state = states.get(key);
    if (!state) {
      state = { nextRevision: 0 };
      states.set(key, state);
    }
    return state;
  };

  const markSynced = (state: SyncState<T>, attempt: Pending<T>) => {
    state.syncedRevision = attempt.revision;
    state.syncedVersion = options.version(attempt.value);
  };

  const start = (state: SyncState<T>): Promise<boolean> => {
    if (state.running) return state.running;
    const run = (async () => {
      while (state.desired && state.syncedRevision !== state.desired.revision) {
        const attempt = state.desired;
        try {
          await options.write(attempt.value);
          markSynced(state, attempt);
        } catch (error) {
          if (state.desired.revision !== attempt.revision) continue;
          if (!options.onError?.(attempt.value, error)) return false;
          markSynced(state, attempt);
          return true;
        }
      }
      return true;
    })();
    state.running = run.finally(() => {
      state.running = undefined;
    });
    return state.running;
  };

  const requestLatest = (value: T): Promise<boolean> => {
    const state = stateFor(options.key(value));
    const nextVersion = options.version(value);
    const desiredVersion = state.desired ? options.version(state.desired.value) : undefined;
    const hasUnsyncedDesired =
      state.desired !== undefined && state.syncedRevision !== state.desired.revision;
    const newerThanDesired =
      hasUnsyncedDesired && desiredVersion !== undefined && nextVersion > desiredVersion;
    const newerThanSynced =
      !hasUnsyncedDesired &&
      (state.syncedVersion === undefined || nextVersion > state.syncedVersion);
    if (newerThanDesired || newerThanSynced) {
      state.desired = { revision: ++state.nextRevision, value };
    }
    if (!state.desired && state.syncedVersion !== undefined && nextVersion <= state.syncedVersion)
      return Promise.resolve(true);
    return start(state);
  };

  const force = (value: T): Promise<boolean> => {
    const state = stateFor(options.key(value));
    state.desired = { revision: ++state.nextRevision, value };
    return start(state);
  };

  return { force, requestLatest };
}
