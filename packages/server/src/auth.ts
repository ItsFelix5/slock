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

export function authPayloadError(value: unknown) {
  if (!(value && typeof value === "object")) return "Invalid credential payload.";
  const payload: any = value;
  if (typeof payload.domain !== "string" || !SLACK_DOMAIN_RE.test(payload.domain)) {
    return "The copied request is not from a Slack workspace domain.";
  }
  if (
    typeof payload.token !== "string" ||
    !payload.token.startsWith("xoxc-") ||
    payload.token.length > 8192 ||
    !SAFE_CREDENTIAL_VALUE_RE.test(payload.token)
  ) {
    return "The copied request contains an invalid Slack token.";
  }
  if (
    typeof payload.route !== "string" ||
    payload.route.length > 512 ||
    !SAFE_CREDENTIAL_VALUE_RE.test(payload.route)
  ) {
    return "The copied request contains an invalid slack_route value.";
  }
  if (
    typeof payload.slackSession !== "string" ||
    !payload.slackSession.startsWith("xoxd-") ||
    payload.slackSession.length > 8192 ||
    SESSION_INVALID_CHARS_RE.test(payload.slackSession)
  ) {
    return "The copied request contains an invalid Slack session cookie.";
  }
  return null;
}

export function teamIdFromRoute(route: string): string | null {
  return route.split(":").at(-1) ?? null;
}
