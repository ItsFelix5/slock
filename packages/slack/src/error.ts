import type { ApiFailure } from "@slock/types";

export type SlackErrorKind = "auth" | "rate_limited" | "transient" | "deterministic" | "network";

export interface SlackErrorInit {
  code?: string;
  fallback: string;
  retryAfter?: string;
  status?: number;
}

const MAX_ATTEMPTS = 3;
const RATE_LIMIT_CODE = /^rate_?limited$/;
const DETERMINISTIC_CODE =
  /^(channel_not_found|not_in_channel|is_archived|message_not_found|user_not_found|no_permission|access_denied|not_allowed|restricted_action|file_not_found|not_visible|enterprise_is_restricted|thread_not_found|team_not_found|bot_not_found|cant_.+|invalid_.+|missing_.+)$/;
const AUTH_CODES = new Set([
  "not_configured",
  "invalid_auth",
  "not_authed",
  "token_revoked",
  "account_inactive",
]);

export function isAuthError(code: unknown): boolean {
  return typeof code === "string" && AUTH_CODES.has(code);
}

export class SlackError extends Error {
  readonly kind: SlackErrorKind;
  readonly code: string | undefined;
  readonly retryAfterMs: number | undefined;

  constructor(
    init: { kind: SlackErrorKind; message: string; code?: string; retryAfterMs?: number },
    options?: ErrorOptions,
  ) {
    super(init.message, options);
    this.name = "SlackError";
    this.kind = init.kind;
    this.code = init.code;
    this.retryAfterMs = init.retryAfterMs;
  }
}

export function isSlackError(value: unknown): value is SlackError {
  return value instanceof SlackError;
}

function retryAfterMsOf(retryAfter: string | undefined): number | undefined {
  const seconds = retryAfter ? Number(retryAfter) : Number.NaN;
  return Number.isFinite(seconds) ? seconds * 1000 : undefined;
}

function classify(code: string | undefined, status: number | undefined, retryAfterMs?: number) {
  if (isAuthError(code) || status === 401) return "auth";
  if (code && DETERMINISTIC_CODE.test(code)) return "deterministic";
  if (status === 429 || retryAfterMs !== undefined || (code && RATE_LIMIT_CODE.test(code))) {
    return "rate_limited";
  }
  return "transient";
}

export function slackErrorOf(init: SlackErrorInit, options?: ErrorOptions): SlackError {
  const retryAfterMs = retryAfterMsOf(init.retryAfter);
  return new SlackError(
    {
      code: init.code,
      kind: classify(init.code, init.status, retryAfterMs),
      message: init.code ?? init.fallback,
      retryAfterMs,
    },
    options,
  );
}

export function replyError(reply: ApiFailure, fallback: string): SlackError {
  return slackErrorOf({ code: reply.error, fallback, retryAfter: reply.retry_after });
}

export function networkError(cause: unknown): SlackError {
  return new SlackError({ kind: "network", message: "network request failed" }, { cause });
}

export function retryDecision(error: unknown, attempt: number): "retry" | "stop" {
  if (attempt >= MAX_ATTEMPTS) return "stop";
  if (isSlackError(error) && (error.kind === "auth" || error.kind === "deterministic")) {
    return "stop";
  }
  return "retry";
}
