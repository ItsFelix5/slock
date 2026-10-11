import type { AccountSummary, SessionInfo } from "@slock/types";
import { INFO_COOKIE, parseSessionInfo, sessionInfoCookie } from "./info";

const SLACK_DOMAIN_SUFFIX_RE = /(\.enterprise)?\.slack\.com$/;
const INFO_COOKIE_RE = new RegExp(`(?:^|; )${INFO_COOKIE}=([^;]*)`);

let cachedInfo: SessionInfo | null | undefined;

function readInfoCookie(): SessionInfo | null {
  const match = document.cookie.match(INFO_COOKIE_RE);
  return match?.[1] ? parseSessionInfo(match[1]) : null;
}

function info(): SessionInfo | null {
  if (cachedInfo === undefined) cachedInfo = readInfoCookie();
  return cachedInfo;
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

export function getCachedWorkspaceId(): string | null {
  return activeAccount()?.teamId ?? null;
}

export function userProfileUrl(domain: string, userId: string): string {
  const sub = domain.replace(SLACK_DOMAIN_SUFFIX_RE, "");
  return `https://${sub}.enterprise.slack.com/team/${userId}`;
}

export function refreshAccountInfo(): void {
  cachedInfo = undefined;
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
  refreshAccountInfo();
}

export const REAUTH_EVENT = "slock:reauth";

export async function forceReauth(): Promise<never> {
  const activeId = getActiveAccountId();
  if (activeId) await fetch(`/api/session/${activeId}`, { method: "DELETE" }).catch(() => {});
  refreshAccountInfo();
  window.dispatchEvent(new Event(REAUTH_EVENT));
  return new Promise<never>(() => {});
}
