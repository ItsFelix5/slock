import type { Cooldown } from "./cooldown";
import type { Entry, Inflight } from "./entry";
import { delay, type ResourceEnv } from "./env";
import { planRetry, type RetryPolicy } from "./retry";

export interface FetchContext {
  signal: AbortSignal;
}

export interface FetchDeps<K, T> {
  cooldown: Cooldown;
  env: ResourceEnv;
  load: (key: K, context: FetchContext) => Promise<T>;
  onFailure: (entry: Entry<K, T>, error: unknown) => void;
  onSuccess: (entry: Entry<K, T>, data: T) => void;
  retry: RetryPolicy;
}

export async function runFetch<K, T>(
  deps: FetchDeps<K, T>,
  entry: Entry<K, T>,
  inflight: Inflight,
): Promise<void> {
  const { signal } = inflight.controller;
  const isCurrent = () => entry.inflight === inflight;
  for (let attempt = 0; ; attempt++) {
    if (deps.cooldown.active()) await deps.cooldown.wait(signal);
    if (!isCurrent()) return;
    try {
      const data = await deps.load(entry.key, { signal });
      if (isCurrent()) deps.onSuccess(entry, data);
      return;
    } catch (error) {
      if (!isCurrent()) return;
      const plan = planRetry(deps.env, deps.retry, error, attempt);
      if (plan.kind === "stop") return deps.onFailure(entry, error);
      if (plan.kind === "cooldown") deps.cooldown.pause(plan.ms);
      else await delay(deps.env, plan.ms, signal);
    }
  }
}
