import { firstTruthy, isRecord } from "@slock/core";
import type { AccountSummary, SessionInfo } from "@slock/types";
import { isTeamId } from "../ids";

export const INFO_COOKIE = "slock_info";
const MAX_AGE = 34560000;

function isAccountSummary(value: unknown): value is AccountSummary {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.domain === "string" &&
    (value.teamId === null || (typeof value.teamId === "string" && isTeamId(value.teamId)))
  );
}

function decodeCookie(cookieValue: string): unknown {
  try {
    return JSON.parse(decodeURIComponent(cookieValue));
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof URIError) return null;
    throw error;
  }
}

export function parseSessionInfo(cookieValue: string): SessionInfo | null {
  const parsed = decodeCookie(cookieValue);
  if (
    !(
      isRecord(parsed) &&
      (parsed.id === null || typeof parsed.id === "string") &&
      Array.isArray(parsed.accounts) &&
      parsed.accounts.every(isAccountSummary)
    )
  ) {
    return null;
  }
  const { accounts } = parsed;
  return parsed.id === null || accounts.some((account) => account.id === parsed.id)
    ? { accounts, id: parsed.id }
    : null;
}

export function sessionInfoCookie(info: SessionInfo): string {
  return `${INFO_COOKIE}=${encodeURIComponent(JSON.stringify(info))}; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}`;
}

const SLACK_SESSION_INVALID_CHARS = /[;\s]/;

function dCookieValue(part: string): string | undefined {
  const eq = part.indexOf("=");
  const value = part.slice(eq + 1).trim();
  return eq !== -1 &&
    part.slice(0, eq).trim() === "d" &&
    value.startsWith("xoxd-") &&
    !SLACK_SESSION_INVALID_CHARS.test(value)
    ? value
    : undefined;
}

export function extractSlackSession(cookieHeader: string): string | undefined {
  return firstTruthy(cookieHeader.split(";"), dCookieValue);
}
