// The browser can't call Slack directly (no way to attach the session cookie
// Slack's internal API requires — see server.ts), so every Slack method call
// is relayed through our own minimal same-origin server instead. Credentials
// live in an httpOnly cookie the browser set once when the devtools paste was
// submitted (see submitAuthRequest below) — it auto-attaches to every
// same-origin request, including this one, so there's no creds plumbing here.
type PendingSlackCall<T = any> = {
  method: string;
  params: Record<string, string>;
  resolve: (data: T) => void;
  reject: (err: unknown) => void;
};
let pendingSlackCalls: PendingSlackCall[] = [];
let slackBatchScheduled = false;

async function postSlack<T = any>(method: string, params: Record<string, string> = {}): Promise<T> {
  const res = await fetch(`/slack/${method}`, {
    body: JSON.stringify(params),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  return res.json();
}

async function flushSlackBatch() {
  const batch = pendingSlackCalls;
  pendingSlackCalls = [];
  slackBatchScheduled = false;
  if (batch.length === 1) {
    const [call] = batch;
    try {
      call.resolve(await postSlack(call.method, call.params));
    } catch (err) {
      call.reject(err);
    }
    return;
  }
  try {
    const res = await fetch("/slack/batch", {
      body: JSON.stringify({
        calls: batch.map(({ method, params }) => ({ method, params })),
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const data = await res.json();
    const results: unknown[] = data.results ?? [];
    batch.forEach((call, i) => {
      call.resolve(results[i] ?? { error: "batch_failed", ok: false });
    });
  } catch (err) {
    for (const call of batch) call.reject(err);
  }
}

export function callSlack<T = any>(
  method: string,
  params: Record<string, string> = {},
): Promise<T> {
  return new Promise((resolve, reject) => {
    pendingSlackCalls.push({ method, params, reject, resolve });
    if (!slackBatchScheduled) {
      slackBatchScheduled = true;
      queueMicrotask(flushSlackBatch);
    }
  });
}

// Same relay, but for Slack's Edge API cache service — a different host with
// JSON params (arrays allowed), used where Enterprise Grid blocks the regular
// Web API method (e.g. channel membership).
export async function callSlackEdge<T = any>(
  method: string,
  params: Record<string, unknown> = {},
): Promise<T> {
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
const SLACK_FILE_HOSTS = [/\.slack-files\.com$/, /\.slack\.com$/, /\.slack-edge\.com$/];
const SLACK_DOMAIN_SUFFIX_RE = /(\.enterprise)?\.slack\.com$/;

export function fileProxyUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (SLACK_FILE_HOSTS.some((re) => re.test(parsed.hostname))) {
    return `/file?url=${encodeURIComponent(url)}`;
  }
  // Legacy message attachments can carry third-party icon/image URLs (e.g.
  // GitHub's integration footer icon, hosted on slack.github.com) that were
  // never behind Slack's cookie. Those can't just hotlink though: many send
  // `Cross-Origin-Resource-Policy: same-origin`, which blocks the browser
  // from loading them as a direct <img>/<video> src regardless of CORS. Route
  // them through the unauthenticated external media proxy instead — it never
  // sees or forwards the Slack cookie, unlike /file above.
  if (parsed.protocol === "http:" || parsed.protocol === "https:") {
    return `/media-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

// The workspace domain (e.g. "hackclub.slack.com") and team id live in a
// small non-HttpOnly cookie the server sets alongside the real (HttpOnly)
// credentials cookie on login — see slock_info in server/relay-auth.ts. Page
// JS can read it directly, no relay round trip needed.
type SlockInfo = { domain: string; teamId: string | null };
let cachedInfo: SlockInfo | null | undefined;
const INFO_COOKIE_RE = /(?:^|; )slock_info=([^;]*)/;

function readInfoCookie(): SlockInfo | null {
  const match = document.cookie.match(INFO_COOKIE_RE);
  if (!match) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(match[1]));
    return typeof parsed?.domain === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function info(): SlockInfo | null {
  if (cachedInfo === undefined) cachedInfo = readInfoCookie();
  return cachedInfo;
}

// True once the server has credentials for this browser — checked at boot to
// decide whether to show the connect-to-Slack screen. Cheap to call on every
// render since it just reads document.cookie.
export function isConfigured(): boolean {
  return info() !== null;
}

export function getWorkspaceDomain(): Promise<string> {
  return Promise.resolve(info()?.domain ?? "");
}

export function getCachedWorkspaceDomain(): string | null {
  return info()?.domain ?? null;
}

// Same idea as getWorkspaceDomain, for the current team id — needed to
// submit a block action.
export function getWorkspaceTeamId(): Promise<string | null> {
  return Promise.resolve(info()?.teamId ?? null);
}

// A user's Enterprise Grid team profile link — works cross-workspace within
// the same Grid org, unlike a plain channel permalink. On a Grid workspace
// like this one, `domain` from the slock_info cookie is already the "*.enterprise.slack.com"
// hostname (that's what's in the browser's address bar), so this only adds
// the ".enterprise" hop for workspaces where it's still the plain
// "*.slack.com" form — never both, which would produce a malformed
// "*.enterprise.enterprise.slack.com" host.
export function userProfileUrl(domain: string, userId: string): string {
  const sub = domain.replace(SLACK_DOMAIN_SUFFIX_RE, "");
  return `https://${sub}.enterprise.slack.com/team/${userId}`;
}

// Submits the credentials extracted from the pasted devtools request. Only
// Slack's `d` session value is included, not the rest of the browser's Slack
// cookies. The server persists it in an httpOnly cookie directly on the
// response, so page JS has nothing left to store or restore itself.
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
  cachedInfo = undefined;
  await fetch("/auth/logout", { method: "POST" }).catch(() => {
    // best-effort — worst case the user just sees stale state until reload
  });
}
