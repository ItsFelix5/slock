type LatestValueSyncOptions<T> = {
  key: (value: T) => string;
  onError?: (value: T, error: unknown) => void;
  version: (value: T) => number;
  write: (value: T) => Promise<void>;
};

type PendingValue<T> = { revision: number; value: T };

export function createLatestValueSync<T>(options: LatestValueSyncOptions<T>) {
  const states = new Map<
    string,
    {
      desired?: PendingValue<T>;
      nextRevision: number;
      running?: Promise<boolean>;
      syncedRevision?: number;
      syncedVersion?: number;
    }
  >();

  const stateFor = (key: string) => {
    let state = states.get(key);
    if (!state) {
      state = { nextRevision: 0 };
      states.set(key, state);
    }
    return state;
  };

  const start = (state: ReturnType<typeof stateFor>): Promise<boolean> => {
    if (state.running) return state.running;
    const run = (async () => {
      while (state.desired && state.syncedRevision !== state.desired.revision) {
        const attempt = state.desired;
        try {
          await options.write(attempt.value);
          state.syncedRevision = attempt.revision;
          state.syncedVersion = options.version(attempt.value);
        } catch (error) {
          // A newer cursor superseded the failed request while it was in
          // flight. Send that cursor before reporting an error: Slack only
          // needs the newest successful position, not every intermediate one.
          if (state.desired.revision !== attempt.revision) continue;
          options.onError?.(attempt.value, error);
          return false;
        }
      }
      return true;
    })();
    state.running = run.finally(() => {
      state.running = undefined;
    });
    return state.running;
  };

  function requestLatest(value: T): Promise<boolean> {
    const key = options.key(value);
    const state = stateFor(key);
    const nextVersion = options.version(value);
    const desiredVersion = state.desired ? options.version(state.desired.value) : undefined;
    const hasUnsyncedDesired =
      state.desired !== undefined && state.syncedRevision !== state.desired.revision;
    if (
      (hasUnsyncedDesired && desiredVersion !== undefined && nextVersion > desiredVersion) ||
      (!hasUnsyncedDesired &&
        (state.syncedVersion === undefined || nextVersion > state.syncedVersion))
    ) {
      state.desired = { revision: ++state.nextRevision, value };
    }
    if (!state.desired && state.syncedVersion !== undefined && nextVersion <= state.syncedVersion)
      return Promise.resolve(true);
    return start(state);
  }

  function force(value: T): Promise<boolean> {
    const key = options.key(value);
    const state = stateFor(key);
    state.desired = { revision: ++state.nextRevision, value };
    return start(state);
  }

  return { force, requestLatest };
}
