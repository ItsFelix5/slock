import type { ResourceEnv } from "./env";

export type RetryDecision = "retry" | "stop" | { retryAfterMs: number };

export interface RetryPolicy {
  baseMs?: number;
  classify?: (error: unknown) => RetryDecision;
  maxMs?: number;
  retries?: number;
}

export type RetryPlan =
  | { kind: "stop" }
  | { kind: "backoff"; ms: number }
  | { kind: "cooldown"; ms: number };

const STOP: RetryPlan = { kind: "stop" };

export function backoffMs(
  env: ResourceEnv,
  attempt: number,
  policy: Pick<RetryPolicy, "baseMs" | "maxMs">,
): number {
  const capped = Math.min(policy.maxMs ?? 30_000, (policy.baseMs ?? 1_000) * 2 ** attempt);
  return capped / 2 + (env.random() * capped) / 2;
}

export function planRetry(
  env: ResourceEnv,
  policy: RetryPolicy,
  error: unknown,
  attempt: number,
): RetryPlan {
  if (attempt >= (policy.retries ?? 3)) return STOP;
  const decision = policy.classify?.(error) ?? "retry";
  if (decision === "stop") return STOP;
  if (decision === "retry") return { kind: "backoff", ms: backoffMs(env, attempt, policy) };
  return { kind: "cooldown", ms: decision.retryAfterMs };
}
