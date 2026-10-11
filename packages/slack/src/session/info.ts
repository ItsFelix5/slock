import { isRecord } from "@slock/core";
import type { AccountSummary, SessionInfo } from "@slock/types";

export const INFO_COOKIE = "slock_info";
const MAX_AGE = 34560000;

export function parseSessionInfo(cookieValue: string): SessionInfo | null {
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(cookieValue));
    if (
      !(
        isRecord(parsed) &&
        (parsed.id === null || typeof parsed.id === "string") &&
        Array.isArray(parsed.accounts)
      )
    ) {
      return null;
    }
    const accounts: AccountSummary[] = parsed.accounts;
    return parsed.id === null || accounts.some((account) => account.id === parsed.id)
      ? { accounts, id: parsed.id }
      : null;
  } catch {
    return null;
  }
}

export function sessionInfoCookie(info: SessionInfo): string {
  return `${INFO_COOKIE}=${encodeURIComponent(JSON.stringify(info))}; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}`;
}

const SLACK_SESSION_INVALID_CHARS = /[;\s]/;

export function extractSlackSession(cookieHeader: string): string | undefined {
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1 || part.slice(0, eq).trim() !== "d") continue;
    const value = part.slice(eq + 1).trim();
    if (value.startsWith("xoxd-") && !SLACK_SESSION_INVALID_CHARS.test(value)) return value;
  }
}
