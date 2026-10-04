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

export type ApiFailure = { error?: string; ok: false; retry_after?: string };
export type ApiReply<T extends object = object> = (T & { ok: true }) | ApiFailure;

function parseBody(responseBody: string, res: Response) {
  try {
    return JSON.parse(responseBody);
  } catch (error) {
    throw new Error(
      res.ok
        ? "expected a JSON response"
        : responseBody || `request failed with ${res.status} ${res.statusText}`,
      { cause: error },
    );
  }
}

async function readResponse<T extends object>(res: Response): Promise<ApiReply<T>> {
  const responseBody = await res.text();
  const data = parseBody(responseBody, res);
  if (hasError(data) && data.error === "not_configured" && isConfigured()) return forceReauth();
  if (!(res.ok || hasError(data))) {
    throw new Error(`request failed with ${res.status} ${res.statusText}: ${responseBody}`);
  }
  return { ...data, ok: res.ok };
}

async function request<T extends object>(
  method: string,
  path: string,
  requestBody?: unknown,
): Promise<ApiReply<T>> {
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

export function apiGet<T extends object = object>(path: string): Promise<ApiReply<T>> {
  return request<T>("GET", path);
}
export function apiPost<T extends object = object>(
  path: string,
  body: unknown = {},
): Promise<ApiReply<T>> {
  return request<T>("POST", path, body);
}
export function apiPut<T extends object = object>(
  path: string,
  body: unknown = {},
): Promise<ApiReply<T>> {
  return request<T>("PUT", path, body);
}
export function apiPatch<T extends object = object>(
  path: string,
  body: unknown = {},
): Promise<ApiReply<T>> {
  return request<T>("PATCH", path, body);
}
export function apiDelete<T extends object = object>(
  path: string,
  body?: unknown,
): Promise<ApiReply<T>> {
  return request<T>("DELETE", path, body);
}

export async function apiUpload<T extends object = object>(
  path: string,
  file: File,
): Promise<ApiReply<T>> {
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
  const activeId = getActiveAccountId();
  if (activeId) forgetAccount(activeId);
  else clearActiveAccountId();
  await fetch("/api/session", { method: "DELETE" }).catch(() => {});
}

export function forceReauth(): Promise<never> {
  return logout().then(() => {
    location.reload();
    return new Promise<never>(() => {});
  });
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
