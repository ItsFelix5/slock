import { isSlackError } from "@slock/slack";

const MAX_ATTEMPTS = 3;

export function retryDecision(error: unknown, attempt: number): "retry" | "stop" {
  if (attempt >= MAX_ATTEMPTS) return "stop";
  if (isSlackError(error) && (error.kind === "auth" || error.kind === "deterministic")) {
    return "stop";
  }
  return "retry";
}
