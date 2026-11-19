import { defined } from "@slock/core";
import type { GatewayMessageEvent, RawMessage } from "@slock/types";

type Reply = { body?: Record<string, unknown>; path: string[]; query: URLSearchParams };

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, status });

export function createFakeSlack(me: string) {
  const posts = new Map<string, RawMessage[]>();
  let last = 0;
  let postGate: Promise<void> = Promise.resolve();
  let failures = 0;
  let requests: string[] = [];
  let historyGate: Promise<void> = Promise.resolve();
  let repliesGate: Promise<void> = Promise.resolve();
  let dropped: { times: number; ts: string } | undefined;

  const nextTs = () => {
    last = Math.max(last + 1, Date.now() * 1000);
    return (last / 1_000_000).toFixed(6);
  };
  const channel = (id: string) => {
    const list = posts.get(id) ?? [];
    posts.set(id, list);
    return list;
  };
  const parentOf = (id: string, ts: string) => channel(id).find((m) => m.ts === ts);
  const repliesOf = (id: string, ts: string) =>
    channel(id).filter((m) => m.thread_ts === ts && m.ts !== ts);
  const isTopLevel = (m: RawMessage) =>
    !m.thread_ts || m.thread_ts === m.ts || m.subtype === "thread_broadcast";

  function withThreadFields(id: string, m: RawMessage): RawMessage {
    const replies = repliesOf(id, m.ts);
    if (replies.length === 0) return m;
    return {
      ...m,
      latest_reply: replies.at(-1)?.ts,
      reply_count: replies.length,
      reply_users: [...new Set(replies.map((r) => r.user ?? ""))],
    };
  }

  function say(
    id: string,
    user: string,
    text: string,
    options: { at?: number; threadTs?: string; subtype?: string } = {},
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
    channel(id).sort((a, b) => Number(a.ts) - Number(b.ts));
    return raw;
  }

  function history(id: string, query: URLSearchParams) {
    const latest = query.get("latest");
    const oldest = query.get("oldest");
    const inclusive = query.get("inclusive") === "true";
    const limit = Number(query.get("limit") ?? 30);
    const matching = channel(id)
      .filter(isTopLevel)
      .filter((m) => {
        if (latest && (inclusive ? m.ts > latest : m.ts >= latest)) return false;
        if (oldest && (inclusive ? m.ts < oldest : m.ts <= oldest)) return false;
        return true;
      });
    const page = oldest && !latest ? matching.slice(0, limit) : matching.slice(-limit);
    return {
      has_more: matching.length > page.length,
      messages: page.map((m) => withThreadFields(id, m)).reverse(),
      ok: true,
    };
  }

  function replies(id: string, threadTs: string, query: URLSearchParams) {
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
          .filter((m) => !oldest || (inclusive ? m.ts >= oldest : m.ts > oldest))
          .filter((m) => !latest || (inclusive ? m.ts <= latest : m.ts < latest));
    const room = limit - root.length;
    return {
      has_more: matching.length > room,
      messages: [...root, ...matching.slice(0, room)],
      ok: true,
    };
  }

  async function route(method: string, { body, path, query }: Reply) {
    const [, , id = "", kind, ts, tail] = path;
    if (kind === "threads" && method === "GET") {
      const snapshot = replies(id, defined(ts), query);
      await repliesGate;
      return snapshot;
    }
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
      const threadTs = typeof body?.threadTs === "string" ? body.threadTs : undefined;
      const text = typeof body?.text === "string" ? body.text : "";
      return { ok: true, ts: say(id, me, text, { threadTs }).ts };
    }
    const target = channel(id).find((m) => m.ts === ts);
    if (!(target && tail === undefined)) return { error: "message_not_found", ok: false };
    if (method === "PATCH") {
      if (typeof body?.text === "string") target.text = body.text;
      target.edited = { ts: nextTs(), user: me };
    } else {
      posts.set(
        id,
        channel(id).filter((m) => m.ts !== ts),
      );
    }
    return { ok: true };
  }

  const original = globalThis.fetch;
  globalThis.fetch = Object.assign(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input), "http://slack.test");
      const method = init?.method ?? "GET";
      requests.push(`${method} ${url.pathname}`);
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      const result = await route(method, {
        body,
        path: url.pathname.split("/").filter(Boolean),
        query: url.searchParams,
      });
      return json(result, "ok" in result && result.ok ? 200 : 400);
    },
    { preconnect: original.preconnect },
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
    deleted: (id: string, ts: string): GatewayMessageEvent => ({
      channel: id,
      deleted_ts: ts,
      subtype: "message_deleted",
      type: "message",
    }),
    echo: (id: string, raw: RawMessage): GatewayMessageEvent => ({
      ...raw,
      channel: id,
      type: "message",
    }),
    edited: (id: string, ts: string): GatewayMessageEvent => ({
      channel: id,
      message: { ...defined(parentOf(id, ts)), edited: { ts: nextTs(), user: me } },
      subtype: "message_changed",
      type: "message",
    }),
    dropReply(ts: string, times: number) {
      dropped = { times, ts };
    },
    failNextPosts(count: number) {
      failures = count;
    },
    findPosted: (id: string, text: string) => channel(id).find((m) => m.text === text),
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
    remove(id: string, ts: string) {
      posts.set(
        id,
        channel(id).filter((m) => m.ts !== ts),
      );
    },
    replied: (id: string, threadTs: string): GatewayMessageEvent => ({
      channel: id,
      message: withThreadFields(id, defined(parentOf(id, threadTs))),
      subtype: "message_replied",
      type: "message",
    }),
    requests: () => requests,
    resetRequests() {
      requests = [];
    },
    restore() {
      globalThis.fetch = original;
    },
    say,
    serverMessages: (id: string) => channel(id),
  };
}

export type FakeSlack = ReturnType<typeof createFakeSlack>;
