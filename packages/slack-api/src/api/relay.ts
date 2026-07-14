// The browser can't call Slack directly (no way to attach the session cookie
// Slack's internal API requires — see server.ts), so every Slack method call
// is relayed through our own minimal same-origin server instead. Credentials
// live in an httpOnly cookie the browser set once when the devtools paste was
// submitted (see submitAuthRequest below) — it auto-attaches to every
// same-origin request, including this one, so there's no creds plumbing here.
export async function callSlack(method: string, params: Record<string, string> = {}): Promise<any> {
  const res = await fetch(`/slack/${method}`, {
    body: JSON.stringify(params),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  return res.json();
}

// Same relay, but for Slack's Edge API cache service — a different host with
// JSON params (arrays allowed), used where Enterprise Grid blocks the regular
// Web API method (e.g. channel membership).
export async function callSlackEdge(
  method: string,
  params: Record<string, unknown> = {},
): Promise<any> {
  const res = await fetch(`/slack-edge/${method}`, {
    body: JSON.stringify(params),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  return res.json();
}

// Every displayed Slack file (avatars, attachments, emoji, block-kit images)
// has to go through here rather than hotlinking the raw URL: Slack sets its
// session cookie SameSite, so it's never attached to a cross-site subresource
// request like an <img>/<video> src, only to same-site/top-level navigation.
// This proxies the request server-side instead, using the cookie the relay
// holds for the caller (see fileProxyResponse in server/relay-core.ts).
// Legacy message attachments can also carry third-party icon/image URLs (e.g.
// a bot integration's own avatar host) that were never behind Slack's cookie
// in the first place — those still hotlink fine, and the server's own host
// allowlist would 403 them anyway, so only rewrite URLs on Slack's domains.
const SLACK_FILE_HOSTS = [/\.slack-files\.com$/, /\.slack\.com$/, /\.slack-edge\.com$/];
const SLACK_DOMAIN_SUFFIX_RE = /(\.enterprise)?\.slack\.com$/;

export function fileProxyUrl(url: string): string {
  try {
    if (!SLACK_FILE_HOSTS.some((re) => re.test(new URL(url).hostname))) return url;
  } catch {
    return url;
  }
  return `/file?url=${encodeURIComponent(url)}`;
}

// The workspace domain (e.g. "hackclub.slack.com") lives in the same cookie
// as the rest of the credentials, which page JS can't read directly (it's
// httpOnly) — fetched once from the server, which can, and cached since it
// never changes at runtime. `cachedDomainValue` mirrors the resolved promise
// synchronously — index.tsx's boot-time getConfig() call (made before the
// composer can even mount) already seeds it, so anything that needs the
// domain synchronously (e.g. serializing a composer chip) can just read it.
let cachedDomainValue: string | null = null;
let workspaceDomain: Promise<string> | null = null;
export function getWorkspaceDomain(): Promise<string> {
  if (cachedDomainValue) return Promise.resolve(cachedDomainValue);
  if (!workspaceDomain) {
    workspaceDomain = fetch("/config")
      .then((res) => res.json())
      .then((data) => {
        cachedDomainValue = data.domain as string;
        return cachedDomainValue;
      })
      .catch((err) => {
        workspaceDomain = null;
        throw err;
      });
  }
  return workspaceDomain;
}

export function getCachedWorkspaceDomain(): string | null {
  return cachedDomainValue;
}

// A user's Enterprise Grid team profile link — works cross-workspace within
// the same Grid org, unlike a plain channel permalink. On a Grid workspace
// like this one, `domain` from /config is already the "*.enterprise.slack.com"
// hostname (that's what's in the browser's address bar), so this only adds
// the ".enterprise" hop for workspaces where it's still the plain
// "*.slack.com" form — never both, which would produce a malformed
// "*.enterprise.enterprise.slack.com" host.
export function userProfileUrl(domain: string, userId: string): string {
  const sub = domain.replace(SLACK_DOMAIN_SUFFIX_RE, "");
  return `https://${sub}.enterprise.slack.com/team/${userId}`;
}

// Unlike getWorkspaceDomain, this is never cached — it's polled by the
// connect-to-slack screen while waiting for credentials, and used once at
// boot to decide whether to show that screen at all. Reads only the current
// request's own cookie server-side, so it stays correct with many different
// people using the same deployment at once. Still seeds the workspace-domain
// cache above when it has a domain to offer, since App only ever mounts
// after this resolves once.
export async function getConfig(): Promise<{ domain: string | null; configured: boolean }> {
  const res = await fetch("/config");
  const data = await res.json();
  if (data.domain) cachedDomainValue = data.domain;
  return data;
}

// Submits a request pasted from devtools (see server/parse-auth-request.ts)
// so the relay can extract a token/cookie/route from it. The server sets
// those as an httpOnly cookie directly on the response — page JS never sees
// the raw token/cookie, and there's nothing left for the client to store or
// restore itself (the cookie persists in the browser regardless of the
// server process's lifetime).
export async function submitAuthRequest(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/auth", {
    body: JSON.stringify(raw),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  return res.json();
}

// Tells the server to clear the credentials cookie. Caller is expected to
// reload/re-render into ConnectSlack afterward.
export async function logout(): Promise<void> {
  workspaceDomain = null;
  cachedDomainValue = null;
  await fetch("/auth/logout", { method: "POST" }).catch(() => {
    // best-effort — worst case the user just sees stale state until reload
  });
}
