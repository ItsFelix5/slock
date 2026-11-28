import { defined } from "@slock/core";
import { compareTs } from "@slock/slack";
import type { ChannelId, GatewayMessageEvent, RawMessage, Ts, UserId } from "@slock/types";
import type { FakeEnv } from "../../../../support/core";
import { ch, stamp } from "../../../../support/slack";
import { createFakeReactions } from "./fakeReactions";

type Reply = { body?: Record<string, unknown>; path: string[]; query: URLSearchParams };

const byTs = (a: string, b: string) => compareTs(stamp(a), stamp(b));

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, status });

export function createFakeSlack(me: UserId, env: FakeEnv) {
  const posts = new Map<ChannelId, RawMessage[]>();
  const reactions = createFakeReactions();
  let last = 0;
  let postGate: Promise<void> = Promise.resolve();
  let failures = 0;
  let reactionFailures = 0;
  let requests: string[] = [];
  let historyGate: Promise<void> = Promise.resolve();
  let repliesGate: Promise<void> = Promise.resolve();
  let dropped: { times: number; ts: Ts } | undefined;

  const nextTs = () => {
    last = Math.max(last + 1, env.now() * 1000 + 1);
    return stamp((last / 1_000_000).toFixed(6));
  };
  const channel = (id: ChannelId) => {
    const list = posts.get(id) ?? [];
    posts.set(id, list);
    return list;
  };
  const parentOf = (id: ChannelId, ts: Ts) => channel(id).find((m) => m.ts === ts);
  const repliesOf = (id: ChannelId, ts: Ts) =>
    channel(id).filter((m) => m.thread_ts === ts && m.ts !== ts);
  const isTopLevel = (m: RawMessage) =>
    !m.thread_ts || m.thread_ts === m.ts || m.subtype === "thread_broadcast";

  function withThreadFields(id: ChannelId, m: RawMessage): RawMessage {
    const base = reactions.attach(id, m);
    const replies = repliesOf(id, stamp(m.ts));
    if (replies.length === 0) return base;
    return {
      ...base,
      latest_reply: replies.at(-1)?.ts,
      reply_count: replies.length,
      reply_users: [...new Set(replies.map((r) => r.user ?? ""))],
    };
  }

  function say(
    id: ChannelId,
    user: UserId,
    text: string,
    options: { at?: number; threadTs?: Ts; subtype?: string } = {},
  ) {
    const raw: RawMessage = {
      subtype: options.subtype,
      text,
      thread_ts: options.threadTs,
      ts: options.at === undefined ? nextTs() : options.at.toFixed(6),
      type: "message",
      user,
    };
    channel(id).push(raw);
    channel(id).sort((a, b) => byTs(a.ts, b.ts));
    return raw;
  }

  function edit(id: ChannelId, ts: Ts, text?: string) {
    const target = defined(parentOf(id, ts));
    if (text !== undefined) target.text = text;
    target.edited = { ts: nextTs(), user: target.user ?? me };
  }

  function history(id: ChannelId, query: URLSearchParams) {
    const latest = query.get("latest");
    const oldest = query.get("oldest");
    const inclusive = query.get("inclusive") === "true";
    const limit = Number(query.get("limit") ?? 30);
    const matching = channel(id)
      .filter(isTopLevel)
      .filter((m) => {
        if (latest && (inclusive ? byTs(m.ts, latest) > 0 : byTs(m.ts, latest) >= 0)) return false;
        if (oldest && (inclusive ? byTs(m.ts, oldest) < 0 : byTs(m.ts, oldest) <= 0)) return false;
        return true;
      });
    const page = oldest && !latest ? matching.slice(0, limit) : matching.slice(-limit);
    return {
      has_more: matching.length > page.length,
      messages: page.map((m) => withThreadFields(id, m)).reverse(),
      ok: true,
    };
  }

  function replies(id: ChannelId, threadTs: Ts, query: URLSearchParams) {
    const oldest = query.get("oldest");
    const inclusive = query.get("inclusive") === "true";
    const limit = Number(query.get("limit") ?? 100);
    const parent = parentOf(id, threadTs);
    const root = parent ? [withThreadFields(id, parent)] : [];
    const skip = dropped?.times ? dropped.ts : undefined;
    if (dropped?.times) dropped.times--;
    const all = repliesOf(id, threadTs).filter((m) => m.ts !== skip);
    const latest = query.get("latest");
    const unranged = !(oldest || latest) && all.length >= limit;
    const matching = unranged
      ? [defined(all[Math.floor(all.length / 2)]), ...all.slice(limit - 1)]
      : all
          .filter((m) => !oldest || (inclusive ? byTs(m.ts, oldest) >= 0 : byTs(m.ts, oldest) > 0))
          .filter((m) => !latest || (inclusive ? byTs(m.ts, latest) <= 0 : byTs(m.ts, latest) < 0));
    const room = limit - root.length;
    return {
      has_more: matching.length > room,
      messages: [...root, ...matching.slice(0, room)],
      ok: true,
    };
  }

  async function route(method: string, { body, path, query }: Reply) {
    if (path[1] === "messages" && path[4] === "reactions") {
      const name = typeof body?.name === "string" ? body.name : "";
      const on = method === "POST";
      if (reactionFailures > 0) {
        reactionFailures--;
        return { error: "ratelimited", ok: false };
      }
      if (!reactions.set(ch(path[2] ?? ""), stamp(path[3] ?? ""), name, me, on))
        return { error: on ? "already_reacted" : "no_reaction", ok: false };
      return { ok: true };
    }
    const [, , rawId = "", kind, rawTs, tail] = path;
    const id = ch(rawId);
    const ts = rawTs === undefined ? undefined : stamp(rawTs);
    if (kind === "threads" && method === "GET") {
      const snapshot = replies(id, defined(ts), query);
      await repliesGate;
      return snapshot;
    }
    if (kind === "threads" && tail === "subscription") return { ok: true };
    if (kind !== "messages") return { error: "not_found", ok: false };
    if (method === "GET") {
      const snapshot = history(id, query);
      await historyGate;
      return snapshot;
    }
    if (method === "POST") {
      await postGate;
      if (failures > 0) {
        failures--;
        return { error: "ratelimited", ok: false };
      }
      const threadTs = typeof body?.threadTs === "string" ? stamp(body.threadTs) : undefined;
      const text = typeof body?.text === "string" ? body.text : "";
      return { ok: true, ts: say(id, me, text, { threadTs }).ts };
    }
    const target = channel(id).find((m) => m.ts === ts);
    if (!(target && tail === undefined)) return { error: "message_not_found", ok: false };
    if (method === "PATCH") {
      edit(id, defined(ts), typeof body?.text === "string" ? body.text : undefined);
    } else {
      posts.set(
        id,
        channel(id).filter((m) => m.ts !== ts),
      );
    }
    return { ok: true };
  }

  env.fetch.respond(
    () => true,
    async ({ init, method, url: href }) => {
      const url = new URL(href, "http://slack.test");
      requests.push(`${method} ${url.pathname}`);
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      const result = await route(method, {
        body,
        path: url.pathname.split("/").filter(Boolean),
        query: url.searchParams,
      });
      return json(result, "ok" in result && result.ok ? 200 : 400);
    },
  );

  const hold = () => {
    let release = () => {};
    return {
      promise: new Promise<void>((resolve) => {
        release = resolve;
      }),
      release: () => release(),
    };
  };

  return {
    deleted: (id: ChannelId, ts: Ts): GatewayMessageEvent => ({
      channel: id,
      deleted_ts: ts,
      subtype: "message_deleted",
      type: "message",
    }),
    echo: (id: ChannelId, raw: RawMessage): GatewayMessageEvent => ({
      ...raw,
      channel: id,
      type: "message",
    }),
    edited: (id: ChannelId, ts: Ts): GatewayMessageEvent => ({
      channel: id,
      message: { ...defined(parentOf(id, ts)), edited: { ts: nextTs(), user: me } },
      subtype: "message_changed",
      type: "message",
    }),
    edit,
    reacted: reactions.event,
    react: reactions.set,
    reactionUsers: reactions.users,
    dropReply(ts: Ts, times: number) {
      dropped = { times, ts };
    },
    failNextReactions(count: number) {
      reactionFailures = count;
    },
    failNextPosts(count: number) {
      failures = count;
    },
    findPosted: (id: ChannelId, text: string) => channel(id).find((m) => m.text === text),
    holdHistory() {
      const gate = hold();
      historyGate = gate.promise;
      return () => {
        historyGate = Promise.resolve();
        gate.release();
      };
    },
    holdReplies() {
      const gate = hold();
      repliesGate = gate.promise;
      return () => {
        repliesGate = Promise.resolve();
        gate.release();
      };
    },
    holdPosts() {
      const gate = hold();
      postGate = gate.promise;
      return () => {
        postGate = Promise.resolve();
        gate.release();
      };
    },
    remove(id: ChannelId, ts: Ts) {
      posts.set(
        id,
        channel(id).filter((m) => m.ts !== ts),
      );
    },
    replied: (id: ChannelId, threadTs: Ts): GatewayMessageEvent => ({
      channel: id,
      message: withThreadFields(id, defined(parentOf(id, threadTs))),
      subtype: "message_replied",
      type: "message",
    }),
    requests: () => requests,
    resetRequests() {
      requests = [];
    },
    say,
    serverMessages: (id: ChannelId) => channel(id),
  };
}
