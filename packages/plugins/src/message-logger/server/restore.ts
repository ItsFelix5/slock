import { type HttpHandler, isRecord } from "@slock/core";
import { compareTs, isChannelId, isRawMessage, isTs, parseTs } from "@slock/slack";
import type { ChannelId, RawMessage, Ts } from "@slock/types";
import { jsonHeaders } from "../../slack/server/api/auth";
import type { LogStore, TsRange } from "./store";
import { workspaceOf } from "./workspace";

const HISTORY_PATH = /^\/api\/channels\/([^/]+)\/messages$/;
const REPLIES_PATH = /^\/api\/channels\/([^/]+)\/threads\/([^/]+)\/messages$/;

type Page = { has_more?: boolean; messages?: RawMessage[] };

function isMessage(value: unknown): value is RawMessage {
  return isRecord(value) && isRawMessage(value);
}

function parsePage(body: unknown): Page {
  if (!isRecord(body)) return {};
  return {
    ...body,
    has_more: body.has_more === true,
    messages: Array.isArray(body.messages) ? body.messages.filter(isMessage) : undefined,
  };
}

function extremes(page: Page) {
  const stamps = (page.messages ?? [])
    .map((message) => message.ts)
    .filter(isTs)
    .sort(compareTs);
  return { newest: stamps.at(-1), oldest: stamps[0] };
}

function tsParam(query: URLSearchParams, name: string): Ts | undefined {
  const value = query.get(name);
  return value && isTs(value) ? value : undefined;
}

function historyRange(page: Page, query: URLSearchParams): TsRange {
  return {
    max: tsParam(query, "latest"),
    min: page.has_more ? extremes(page).oldest : tsParam(query, "oldest"),
  };
}

function repliesRange(page: Page, query: URLSearchParams): TsRange {
  const { newest, oldest } = extremes(page);
  return {
    max: page.has_more ? newest : tsParam(query, "latest"),
    min: query.has("cursor") ? oldest : tsParam(query, "oldest"),
  };
}

function targetOf(pathname: string): { channel: ChannelId; threadTs?: Ts } | null {
  const replies = REPLIES_PATH.exec(pathname);
  const [channel, threadTs] = (replies ?? HISTORY_PATH.exec(pathname))?.slice(1) ?? [];
  if (!(channel && isChannelId(channel))) return null;
  if (!replies) return { channel };
  return threadTs && isTs(threadTs) ? { channel, threadTs } : null;
}

export function restoreDeleted(store: LogStore): HttpHandler {
  return async (c, next) => {
    const { pathname, searchParams } = c.url;
    const target = targetOf(pathname);
    const { creds } = c;
    const res = await next();
    if (c.req.method !== "GET" || !target || !res?.ok || !creds) return res;
    const workspace = workspaceOf(creds);
    const page = parsePage(await res.json());
    const live = page.messages ?? [];
    const { channel, threadTs } = target;
    const kept = threadTs
      ? store.threadMessages(workspace, channel, threadTs, repliesRange(page, searchParams))
      : store.channelMessages(workspace, channel, historyRange(page, searchParams));
    const liveTs = new Set(live.map((message) => message.ts));
    const restored = kept.filter((message) => !liveTs.has(message.ts));
    const direction = threadTs ? 1 : -1;
    const messages = [...live, ...restored].sort(
      (a, b) => direction * compareTs(parseTs(a.ts), parseTs(b.ts)),
    );
    return new Response(JSON.stringify({ ...page, messages }), { headers: jsonHeaders });
  };
}
