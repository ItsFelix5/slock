// Purpose-built route transport: `path` is one of the app server's own
// routes (e.g. "/api/channels/C123/messages"), never a raw Slack method name
// — the server decides internally what Slack call(s) to make and returns
// only the fields that route's caller needs.

function hasError(data: unknown): data is { error: string } {
  return !!(
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    "error" in data &&
    typeof data.error === "string"
  );
}

async function readResponse<T>(res: Response): Promise<T> {
  const responseBody = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(responseBody);
  } catch (error) {
    if (!res.ok) {
      throw new Error(responseBody || `request failed with ${res.status} ${res.statusText}`, {
        cause: error,
      });
    }
    return responseBody as T;
  }
  if (!(res.ok || hasError(data))) {
    throw new Error(`request failed with ${res.status} ${res.statusText}: ${responseBody}`);
  }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return { ...data, ok: res.ok } as T;
  }
  return data as T;
}

async function request<T = any>(method: string, path: string, requestBody?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    ...(requestBody === undefined
      ? {}
      : { body: JSON.stringify(requestBody), headers: { "content-type": "application/json" } }),
  });
  return readResponse<T>(res);
}

export function apiGet<T = any>(path: string): Promise<T> {
  return request<T>("GET", path);
}
export function apiPost<T = any>(path: string, body: unknown = {}): Promise<T> {
  return request<T>("POST", path, body);
}
export function apiPut<T = any>(path: string, body: unknown = {}): Promise<T> {
  return request<T>("PUT", path, body);
}
export function apiPatch<T = any>(path: string, body: unknown = {}): Promise<T> {
  return request<T>("PATCH", path, body);
}
export function apiDelete<T = any>(path: string, body?: unknown): Promise<T> {
  return request<T>("DELETE", path, body);
}

export async function apiUpload<T = any>(path: string, file: File): Promise<T> {
  const res = await fetch(path, {
    body: file,
    headers: file.type ? { "content-type": file.type } : undefined,
    method: "POST",
  });
  return readResponse<T>(res);
}

const SLACK_DOMAIN_SUFFIX_RE = /(\.enterprise)?\.slack\.com$/;

// Slack asset URLs are replaced by signed, same-origin resource URLs before
// server responses reach the browser. Third-party URLs remain ordinary links.
export function resolveMediaUrl(url: string): string {
  return url;
}

// The workspace domain (e.g. "hackclub.slack.com") and team id live in a
// small non-HttpOnly cookie the server sets alongside the real (HttpOnly)
// credentials cookie on login — see slock_info in server/auth.ts. Page JS can
// read it directly without another request.
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
  const res = await fetch("/api/session", {
    body: JSON.stringify(raw),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  return { ...(await res.json()), ok: res.ok };
}

// Tells the server to clear the credentials cookie. Caller is expected to
// reload/re-render into ConnectSlack afterward.
export async function logout(): Promise<void> {
  cachedInfo = undefined;
  await fetch("/api/session", { method: "DELETE" }).catch(() => {
    // best-effort — worst case the user just sees stale state until reload
  });
}
