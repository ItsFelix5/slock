import type { Overlay } from "./cacheTypes";

interface Overlayable<K, T> {
  overlay(key: K, apply: (data: T) => T): Overlay;
}

export interface Transaction {
  apply<K, T>(target: Overlayable<K, T>, key: K, change: (data: T) => T): void;
  hold(overlay: Overlay): void;
}

export interface MutationOptions<V, R> {
  key?: (variables: V) => string;
  mode?: "parallel" | "single" | "queue" | "latest";
  onError?: (error: unknown, variables: V) => void;
  onSuccess?: (result: R, variables: V) => void;
  optimistic?: (variables: V, transaction: Transaction) => void;
  run: (variables: V) => Promise<R>;
  settles?: (error: unknown, variables: V) => boolean;
  version?: (variables: V) => number;
}

export interface Mutation<V> {
  pending(key?: string): boolean;
  run(variables: V, options?: { force?: boolean }): Promise<boolean>;
  subscribe(listener: () => void): () => void;
}

interface Job<V> {
  layers: Overlay[];
  variables: V;
}

interface Lane<V> {
  count: number;
  draining?: Promise<boolean>;
  requested?: number;
  synced?: number;
  tail: Promise<unknown>;
  waiting?: Job<V>;
}

export function createMutation<V, R = void>(options: MutationOptions<V, R>): Mutation<V> {
  const { mode = "parallel" } = options;
  const lanes = new Map<string, Lane<V>>();
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const laneOf = (variables: V) => {
    const key = options.key?.(variables) ?? "";
    let lane = lanes.get(key);
    if (!lane) {
      lane = { count: 0, tail: Promise.resolve() };
      lanes.set(key, lane);
    }
    return lane;
  };

  const prepare = (variables: V): Job<V> => {
    const layers: Overlay[] = [];
    options.optimistic?.(variables, {
      apply: (target, key, change) => void layers.push(target.overlay(key, change)),
      hold: (overlay) => void layers.push(overlay),
    });
    return { layers, variables };
  };

  const discard = (job: Job<V>) => {
    for (const layer of job.layers) layer.discard();
  };

  function finish(lane: Lane<V>) {
    lane.count--;
    notify();
  }

  async function execute({ layers, variables }: Job<V>, lane: Lane<V>): Promise<boolean> {
    let done: { result: R } | undefined;
    try {
      done = { result: await options.run(variables) };
    } catch (error) {
      if (!options.settles?.(error, variables)) {
        for (const layer of layers) layer.discard();
        finish(lane);
        if (!lane.waiting) {
          lane.requested = lane.synced;
          options.onError?.(error, variables);
        }
        return false;
      }
    }
    lane.synced = options.version?.(variables);
    for (const layer of layers) layer.commit();
    finish(lane);
    if (done) options.onSuccess?.(done.result, variables);
    return true;
  }

  async function drain(lane: Lane<V>): Promise<boolean> {
    let succeeded = true;
    let thrown: { error: unknown } | undefined;
    for (let job = lane.waiting; job; job = lane.waiting) {
      lane.waiting = undefined;
      try {
        succeeded = await execute(job, lane);
      } catch (error) {
        thrown = { error };
      }
    }
    lane.draining = undefined;
    if (thrown) throw thrown.error;
    return succeeded;
  }

  return {
    pending: (key) =>
      key === undefined
        ? [...lanes.values()].some((lane) => lane.count > 0)
        : (lanes.get(key)?.count ?? 0) > 0,
    run: (variables, runOptions) => {
      const lane = laneOf(variables);
      if (mode === "single" && lane.count > 0) return Promise.resolve(false);
      const version = options.version?.(variables);
      if (version !== undefined) {
        if (!runOptions?.force && lane.requested !== undefined && version <= lane.requested)
          return lane.draining ?? Promise.resolve(true);
        lane.requested = version;
      }
      const job = prepare(variables);
      lane.count++;
      if (mode === "latest") {
        const superseded = lane.waiting;
        lane.waiting = job;
        if (superseded) {
          discard(superseded);
          lane.count--;
        }
        notify();
        lane.draining ??= drain(lane);
        return lane.draining;
      }
      notify();
      if (mode !== "queue") return execute(job, lane);
      const next = lane.tail.then(() => execute(job, lane));
      lane.tail = next.catch(() => {});
      return next;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
