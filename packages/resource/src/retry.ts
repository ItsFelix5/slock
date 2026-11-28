import type { Cooldown } from "./cooldown";
import { delay, type ResourceEnv } from "./delay";

export type RetryDecision = "retry" | "stop" | { retryAfterMs: number };

export interface RetryPolicy {
  baseMs?: number;
  classify?: (error: unknown) => RetryDecision;
  maxMs?: number;
  retries?: number;
}

type RetryPlan =
  | { kind: "stop"; permanent: boolean }
  | { kind: "backoff"; ms: number }
  | { kind: "cooldown"; ms: number };

function backoffMs(
  env: ResourceEnv,
  attempt: number,
  policy: Pick<RetryPolicy, "baseMs" | "maxMs">,
): number {
  const capped = Math.min(policy.maxMs ?? 30_000, (policy.baseMs ?? 1_000) * 2 ** attempt);
  return capped / 2 + (env.random() * capped) / 2;
}

function planRetry(
  env: ResourceEnv,
  policy: RetryPolicy,
  error: unknown,
  attempt: number,
): RetryPlan {
  const decision = policy.classify?.(error) ?? "retry";
  if (decision === "stop") return { kind: "stop", permanent: true };
  if (attempt >= (policy.retries ?? 3)) return { kind: "stop", permanent: false };
  if (decision === "retry") return { kind: "backoff", ms: backoffMs(env, attempt, policy) };
  return { kind: "cooldown", ms: decision.retryAfterMs };
}

export interface RetryDeps {
  cooldown: Cooldown;
  env: ResourceEnv;
  retry: RetryPolicy;
}

type Outcome<R> = { data: R } | { error: unknown; permanent: boolean };

export async function withRetry<R>(
  deps: RetryDeps,
  run: () => Promise<R>,
  signal: AbortSignal,
): Promise<Outcome<R> | undefined> {
  for (let attempt = 0; ; attempt++) {
    if (deps.cooldown.active()) await deps.cooldown.wait(signal);
    if (signal.aborted) return;
    try {
      const data = await run();
      return signal.aborted ? undefined : { data };
    } catch (error) {
      if (signal.aborted) return;
      const plan = planRetry(deps.env, deps.retry, error, attempt);
      if (plan.kind === "stop") return { error, permanent: plan.permanent };
      if (plan.kind === "cooldown") deps.cooldown.pause(plan.ms);
      else await delay(deps.env, plan.ms, signal);
    }
  }
}
