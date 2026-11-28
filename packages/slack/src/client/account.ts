import type { AccountSummary, SessionInfo, TeamId, UserId } from "@slock/types";
import { INFO_COOKIE, parseSessionInfo, sessionInfoCookie } from "../session/info";
import { sendRequest } from "./send";

const SLACK_DOMAIN_SUFFIX_RE = /(\.enterprise)?\.slack\.com$/;
const INFO_COOKIE_RE = new RegExp(`(?:^|; )${INFO_COOKIE}=([^;]*)`);

let parsed: { raw: string | undefined; info: SessionInfo | null } = { info: null, raw: undefined };

function info(): SessionInfo | null {
  const raw = document.cookie.match(INFO_COOKIE_RE)?.[1];
  if (parsed.raw !== raw) parsed = { info: raw ? parseSessionInfo(raw) : null, raw };
  return parsed.info;
}

function activeAccount(): AccountSummary | undefined {
  const current = info();
  return current?.accounts.find((account) => account.id === current.id);
}

export function isConfigured(): boolean {
  return activeAccount() !== undefined;
}

export function getWorkspaceDomain(): Promise<string> {
  return Promise.resolve(activeAccount()?.domain ?? "");
}

export function getCachedWorkspaceDomain() {
  return activeAccount()?.domain ?? null;
}

export function getCachedWorkspaceId(): TeamId | null {
  return activeAccount()?.teamId ?? null;
}

export function userProfileUrl(domain: string, userId: UserId): string {
  const sub = domain.replace(SLACK_DOMAIN_SUFFIX_RE, "");
  return `https://${sub}.enterprise.slack.com/team/${userId}`;
}

export function listAccounts(): AccountSummary[] {
  return info()?.accounts ?? [];
}

export function getActiveAccountId(): string | null {
  return info()?.id ?? null;
}

export function switchAccount(id: string): void {
  const current = info();
  if (current) document.cookie = sessionInfoCookie({ ...current, id });
}

export const REAUTH_EVENT = "slock:reauth";

export async function forceReauth(): Promise<never> {
  const activeId = getActiveAccountId();
  try {
    if (activeId) await sendRequest(`/api/session/${activeId}`, { method: "DELETE" });
  } finally {
    window.dispatchEvent(new Event(REAUTH_EVENT));
  }
  return new Promise<never>(() => {});
}
