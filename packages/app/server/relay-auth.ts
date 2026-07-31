// biome-ignore-all lint/style/useNamingConvention: Relay payloads preserve Slack's wire field names.
export const cors = { "access-control-allow-origin": "*", "content-type": "application/json" };

export type Credentials = { domain: string; token: string; route: string; slackSession: string };
type AuthPayload = Credentials;
const CREDS_COOKIE = "slock_creds";
// Holds only the non-sensitive bits of Credentials (domain, teamId) — never
// HttpOnly, so page JS can read the workspace domain/team id directly
// instead of round-tripping through the server (see getWorkspaceDomain in
// slack-api/src/api/relay.ts). The token/session/route stay in CREDS_COOKIE.
const INFO_COOKIE = "slock_info";
const INVALID_SLACK_SESSION_RE = /[;\s]/;

function extractSlackSession(cookieHeader: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1 || part.slice(0, eq).trim() !== "d") continue;
    const value = part.slice(eq + 1).trim();
    return value.startsWith("xoxd-") && !INVALID_SLACK_SESSION_RE.test(value) ? value : null;
  }
  return null;
}

function isAuthPayload(value: unknown): value is AuthPayload {
  if (!(value && typeof value === "object")) return false;
  const payload = value as Partial<AuthPayload>;
  return (
    typeof payload.domain === "string" &&
    payload.domain.length > 0 &&
    typeof payload.token === "string" &&
    payload.token.length > 0 &&
    typeof payload.route === "string" &&
    payload.route.length > 0 &&
    typeof payload.slackSession === "string" &&
    payload.slackSession.startsWith("xoxd-") &&
    !INVALID_SLACK_SESSION_RE.test(payload.slackSession)
  );
}

export function slackCookieHeader(creds: Credentials): string {
  return `d=${creds.slackSession}`;
}

export function encodeCredsCookie(creds: Credentials, secure: boolean): string {
  const value = encodeURIComponent(JSON.stringify(creds));
  const flags = ["HttpOnly", "SameSite=Strict", "Path=/", "Max-Age=34560000"];
  if (secure) flags.push("Secure");
  return `${CREDS_COOKIE}=${value}; ${flags.join("; ")}`;
}
// `route` is "T..." on a plain workspace, "E...:T..." on Enterprise Grid —
// the team id is always its last segment.
function teamIdFromRoute(route: string): string | null {
  return route.split(":").at(-1) ?? null;
}
function encodeInfoCookie(creds: Credentials, secure: boolean): string {
  const value = encodeURIComponent(
    JSON.stringify({ domain: creds.domain, teamId: teamIdFromRoute(creds.route) }),
  );
  const flags = ["SameSite=Strict", "Path=/", "Max-Age=34560000"];
  if (secure) flags.push("Secure");
  return `${INFO_COOKIE}=${value}; ${flags.join("; ")}`;
}
// Both cookies are always set/cleared together — set-cookie only allows one
// cookie per header instance, so the caller has to append two.
export function credsCookieHeaders(creds: Credentials, secure: boolean): Headers {
  const headers = new Headers(cors);
  headers.append("set-cookie", encodeCredsCookie(creds, secure));
  headers.append("set-cookie", encodeInfoCookie(creds, secure));
  return headers;
}
export function clearedCredsCookieHeaders(): Headers {
  const headers = new Headers(cors);
  headers.append("set-cookie", `${CREDS_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
  headers.append("set-cookie", `${INFO_COOKIE}=; SameSite=Strict; Path=/; Max-Age=0`);
  return headers;
}
export function parseCredsCookie(cookieHeader: string | null): Credentials | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== CREDS_COOKIE) continue;
    try {
      const parsed = JSON.parse(decodeURIComponent(part.slice(eq + 1).trim()));
      if (isAuthPayload(parsed)) return parsed;
      // Migrate credentials saved before Slock stopped retaining the entire
      // copied Slack Cookie header into today's slackSession-only shape.
      // Read-only: nothing rewrites the stored cookie to this canonical
      // form, so this branch runs on every request until the user re-auths.
      const slackSession =
        typeof parsed?.cookie === "string" ? extractSlackSession(parsed.cookie) : null;
      const migrated = { ...parsed, slackSession };
      if (isAuthPayload(migrated)) {
        const { domain, route, token } = migrated;
        return { domain, route, slackSession: migrated.slackSession, token };
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function authResponse(raw: string, secure: boolean): Response {
  try {
    const parsed = JSON.parse(raw);
    if (!isAuthPayload(parsed)) throw new Error("Invalid Slack credentials.");
    const { domain, route, slackSession, token } = parsed;
    const creds = { domain, route, slackSession, token };
    return new Response(JSON.stringify({ ok: true }), {
      headers: credsCookieHeaders(creds, secure),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't parse that request.";
    return new Response(JSON.stringify({ error: message, ok: false }), {
      headers: cors,
      status: 400,
    });
  }
}
export function logoutResponse(): Response {
  return new Response(JSON.stringify({ ok: true }), { headers: clearedCredsCookieHeaders() });
}
