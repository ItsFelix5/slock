import type { HttpHandler } from "@slock/core";
import type { RawMessage } from "@slock/types";
import { rewriteSlackAssetUrls } from "../../slack/server/api/assets";
import { jsonHeaders } from "../../slack/server/api/auth";
import type { LogStore, TsRange } from "./store";
import { workspaceOf } from "./workspace";

const HISTORY_PATH = /^\/api\/channels\/([^/]+)\/messages$/;
const REPLIES_PATH = /^\/api\/channels\/([^/]+)\/threads\/([^/]+)\/messages$/;

type Page = { has_more?: boolean; messages?: RawMessage[] };

function extremes(page: Page) {
  const stamps = (page.messages ?? []).map((message) => message.ts).sort();
  return { newest: stamps.at(-1), oldest: stamps[0] };
}

function historyRange(page: Page, query: URLSearchParams): TsRange {
  return {
    max: query.get("latest") ?? undefined,
    min: page.has_more ? extremes(page).oldest : (query.get("oldest") ?? undefined),
  };
}

function repliesRange(page: Page, query: URLSearchParams): TsRange {
  const { newest, oldest } = extremes(page);
  return {
    max: page.has_more ? newest : (query.get("latest") ?? undefined),
    min: query.has("cursor") ? oldest : (query.get("oldest") ?? undefined),
  };
}

export function restoreDeleted(store: LogStore): HttpHandler {
  return async (c, next) => {
    const { pathname, searchParams } = c.url;
    const replies = REPLIES_PATH.exec(pathname);
    const history = replies ? null : HISTORY_PATH.exec(pathname);
    const { creds } = c;
    const res = await next();
    if (c.req.method !== "GET" || !(replies || history) || !res?.ok || !creds) return res;
    const workspace = workspaceOf(creds);
    const [channel = "", threadTs = ""] = (replies ?? history)?.slice(1) ?? [];
    const page = (await res.json()) as Page;
    const live = page.messages ?? [];
    const kept = replies
      ? store.threadMessages(workspace, channel, threadTs, repliesRange(page, searchParams))
      : store.channelMessages(workspace, channel, historyRange(page, searchParams));
    const liveTs = new Set(live.map((message) => message.ts));
    const restored = kept
      .filter((message) => !liveTs.has(message.ts))
      .map((message) => rewriteSlackAssetUrls(message, creds) as RawMessage);
    const direction = replies ? 1 : -1;
    const messages = [...live, ...restored].sort(
      (a, b) => direction * (Number(a.ts) - Number(b.ts)),
    );
    return new Response(JSON.stringify({ ...page, messages }), { headers: jsonHeaders });
  };
}
