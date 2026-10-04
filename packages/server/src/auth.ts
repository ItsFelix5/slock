import { isRecord } from "@slock/types";

export const jsonHeaders = { "content-type": "application/json" };

export type Credentials = {
  domain: string;
  token: string;
  route: string;
  slackSession: string;
};

const SLACK_DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.(?:enterprise\.)?slack\.com$/i;

const SAFE_CREDENTIAL_VALUE_RE = /^[^\s\p{Cc}]+$/u;
const SESSION_INVALID_CHARS_RE = /[;\s]/;

export function parseCredentials(
  payload: unknown,
): { credentials: Credentials; ok: true } | { error: string; ok: false } {
  if (!isRecord(payload)) return { error: "Invalid credential payload.", ok: false };
  if (typeof payload.domain !== "string" || !SLACK_DOMAIN_RE.test(payload.domain)) {
    return { error: "The copied request is not from a Slack workspace domain.", ok: false };
  }
  if (
    typeof payload.token !== "string" ||
    !payload.token.startsWith("xoxc-") ||
    payload.token.length > 8192 ||
    !SAFE_CREDENTIAL_VALUE_RE.test(payload.token)
  ) {
    return { error: "The copied request contains an invalid Slack token.", ok: false };
  }
  if (
    typeof payload.route !== "string" ||
    payload.route.length > 512 ||
    !SAFE_CREDENTIAL_VALUE_RE.test(payload.route)
  ) {
    return { error: "The copied request contains an invalid slack_route value.", ok: false };
  }
  if (
    typeof payload.slackSession !== "string" ||
    !payload.slackSession.startsWith("xoxd-") ||
    payload.slackSession.length > 8192 ||
    SESSION_INVALID_CHARS_RE.test(payload.slackSession)
  ) {
    return { error: "The copied request contains an invalid Slack session cookie.", ok: false };
  }
  return {
    credentials: {
      domain: payload.domain,
      route: payload.route,
      slackSession: payload.slackSession,
      token: payload.token,
    },
    ok: true,
  };
}

export function teamIdFromRoute(route: string): string | null {
  return route.split(":").at(-1) ?? null;
}
