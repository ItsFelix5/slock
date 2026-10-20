import { isRecord } from "@slock/core";
import { INFO_COOKIE, parseSessionInfo, profileName, sessionInfoCookie } from "@slock/slack";
import type { AccountSummary, RawUserProfile, SessionInfo } from "@slock/types";
import { downloadUrl } from "./assets.ts";
import { type Credentials, jsonHeaders, parseCredentials, teamIdFromRoute } from "./auth.ts";
import { callSlack } from "./slackClient.ts";

type Account = Credentials & { id: string };
type Session = { accounts: Account[]; info: SessionInfo };

const ACCOUNT_PREFIX = "slock_acct_";
const MAX_AGE = 34560000;

function parseCookies(header: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const part of header?.split(";") ?? []) {
    const eq = part.indexOf("=");
    if (eq !== -1) cookies.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
  }
  return cookies;
}

function readAccount(value: string): Account | null {
  try {
    const stored: unknown = JSON.parse(decodeURIComponent(value));
    const parsed = parseCredentials(stored);
    if (!(parsed.ok && isRecord(stored) && typeof stored.id === "string")) return null;
    return { ...parsed.credentials, id: stored.id };
  } catch {
    return null;
  }
}

function readSession(header: string | null): Session {
  const cookies = parseCookies(header);
  const accounts: Account[] = [];
  for (const [name, value] of cookies) {
    const account = name.startsWith(ACCOUNT_PREFIX) ? readAccount(value) : null;
    if (account) accounts.push(account);
  }
  const stored = cookies.get(INFO_COOKIE);
  const info = (stored && parseSessionInfo(stored)) || { accounts: [], id: null };
  return { accounts, info: { ...info, accounts: info.accounts.filter(hasCredentials(accounts)) } };
}

function hasCredentials(accounts: Account[]) {
  return (summary: AccountSummary) => accounts.some((account) => account.id === summary.id);
}

export function credentialsFromCookie(header: string | null): Credentials | null {
  const { accounts, info } = readSession(header);
  return accounts.find((account) => account.id === info.id) ?? null;
}

function accountCookie(account: Account): string {
  const value = encodeURIComponent(JSON.stringify(account));
  return `${ACCOUNT_PREFIX}${account.id}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}`;
}

function expireCookie(name: string): string {
  return `${name}=; SameSite=Strict; Path=/; Max-Age=0`;
}

function sessionResponse(previous: Session, next: Session): Response {
  const headers = new Headers(jsonHeaders);
  const add = (line: string) => headers.append("set-cookie", line);
  for (const account of next.accounts) add(accountCookie(account));
  for (const account of previous.accounts) {
    if (!next.accounts.some((kept) => kept.id === account.id)) {
      add(expireCookie(ACCOUNT_PREFIX + account.id));
    }
  }
  add(next.accounts.length ? sessionInfoCookie(next.info) : expireCookie(INFO_COOKIE));
  return new Response("{}", { headers });
}

async function fetchProfile(creds: Credentials) {
  const reply = await callSlack<{ profile: RawUserProfile }>("users.profile.get", {}, creds);
  return reply.ok ? reply.profile : undefined;
}

export async function accountAvatarResponse(
  cookieHeader: string | null,
  id: string,
): Promise<Response> {
  const creds = readSession(cookieHeader).accounts.find((account) => account.id === id);
  const profile = creds && (await fetchProfile(creds));
  const url = profile?.image_192 || profile?.image_72 || profile?.image_48;
  if (!(creds && url)) return new Response(null, { status: 404 });
  return new Response(null, {
    headers: { "cache-control": "private, max-age=300", location: downloadUrl(url) },
    status: 302,
  });
}

export async function connectAccount(
  cookieHeader: string | null,
  creds: Credentials,
): Promise<Response> {
  const session = readSession(cookieHeader);
  const existing = session.accounts.find((account) => account.token === creds.token);
  const id = existing?.id ?? crypto.randomUUID();
  const summary: AccountSummary = {
    name: profileName(await fetchProfile(creds)),
    domain: creds.domain,
    id,
    teamId: teamIdFromRoute(creds.route),
  };
  return sessionResponse(session, {
    accounts: [...session.accounts.filter((account) => account.id !== id), { ...creds, id }],
    info: {
      accounts: [...session.info.accounts.filter((other) => other.id !== id), summary],
      id,
    },
  });
}

export function removeAccount(cookieHeader: string | null, id: string): Response {
  const session = readSession(cookieHeader);
  return sessionResponse(session, {
    accounts: session.accounts.filter((account) => account.id !== id),
    info: {
      accounts: session.info.accounts.filter((account) => account.id !== id),
      id: session.info.id === id ? null : session.info.id,
    },
  });
}
