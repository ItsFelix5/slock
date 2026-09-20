const SLACK_SESSION_INVALID_CHARS = /[;\s]/;

export function extractSlackSession(cookieHeader: string): string | undefined {
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1 || part.slice(0, eq).trim() !== "d") continue;
    const value = part.slice(eq + 1).trim();
    if (value.startsWith("xoxd-") && !SLACK_SESSION_INVALID_CHARS.test(value)) return value;
  }
}

export class ApiError extends Error {
  retryAfterMs?: number;
  constructor(message: string, retryAfter?: string) {
    super(message);
    this.name = "ApiError";
    const seconds = retryAfter ? Number(retryAfter) : Number.NaN;
    if (Number.isFinite(seconds)) this.retryAfterMs = seconds * 1000;
  }
}

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
  const responseBody: any = await res.text();
  let data: any;
  try {
    data = JSON.parse(responseBody);
  } catch (error) {
    if (!res.ok) {
      throw new Error(responseBody || `request failed with ${res.status} ${res.statusText}`, {
        cause: error,
      });
    }
    return responseBody;
  }
  if (!(res.ok || hasError(data))) {
    throw new Error(`request failed with ${res.status} ${res.statusText}: ${responseBody}`);
  }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return { ...data, ok: res.ok };
  }
  return data;
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

export type StoredAccount = {
  id: string;
  name: string;
  avatarUrl?: string;
  domain: string;
  token: string;
  route: string;
  slackSession: string;
};

const ACCOUNTS_KEY = "slock_accounts";
const ACTIVE_ACCOUNT_KEY = "slock_active_account";

function readStoredAccounts(): StoredAccount[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function listStoredAccounts(): StoredAccount[] {
  return readStoredAccounts();
}

export function rememberAccount(
  account: Omit<StoredAccount, "id"> & { id?: string },
): StoredAccount {
  const accounts = readStoredAccounts();
  const existing = accounts.find((a) => a.token === account.token);
  const id = existing?.id ?? account.id ?? crypto.randomUUID();
  const stored: StoredAccount = { ...account, id };
  localStorage.setItem(
    ACCOUNTS_KEY,
    JSON.stringify([...accounts.filter((a) => a.id !== stored.id), stored]),
  );
  return stored;
}

export function forgetAccount(id: string): void {
  localStorage.setItem(
    ACCOUNTS_KEY,
    JSON.stringify(readStoredAccounts().filter((a) => a.id !== id)),
  );
  if (getActiveAccountId() === id) clearActiveAccountId();
}

export function getActiveAccountId(): string | null {
  return localStorage.getItem(ACTIVE_ACCOUNT_KEY);
}

export function setActiveAccountId(id: string): void {
  localStorage.setItem(ACTIVE_ACCOUNT_KEY, id);
}

export function clearActiveAccountId(): void {
  localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
}
