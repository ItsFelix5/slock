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
      : {
          body: JSON.stringify(requestBody),
          headers: { "content-type": "application/json" },
        }),
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

export function resolveMediaUrl(url: string): string {
  return url;
}

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

export function isConfigured(): boolean {
  return info() !== null;
}

export function getWorkspaceDomain(): Promise<string> {
  return Promise.resolve(info()?.domain ?? "");
}

export function getCachedWorkspaceDomain() {
  return info()?.domain ?? null;
}

export function getCachedWorkspaceId(): string | null {
  return info()?.teamId ?? null;
}

export function userProfileUrl(domain: string, userId: string): string {
  const sub = domain.replace(SLACK_DOMAIN_SUFFIX_RE, "");
  return `https://${sub}.enterprise.slack.com/team/${userId}`;
}

export async function submitAuthRequest(raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/session", {
    body: JSON.stringify(raw),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  return { ...(await res.json()), ok: res.ok };
}

export async function logout(): Promise<void> {
  cachedInfo = undefined;
  await fetch("/api/session", { method: "DELETE" }).catch(() => {});
}
