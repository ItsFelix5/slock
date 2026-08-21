// TEMPORARY offline test server. See mock/README.md for how to use/remove
// this. Patches window.fetch + window.WebSocket so the real app runs
// entirely against in-memory fixture data - no network, no real Slack.
import {
  CH_ANNOUNCE,
  CH_ARCHIVE,
  CH_ENG,
  CH_GENERAL,
  CH_RANDOM,
  DM_ALICE,
  DM_BOB,
  MPDM,
  rawActivityItems,
  rawBootChannels,
  rawBootIms,
  rawBootMpims,
  rawMessagesByChannel,
  rawUsers,
  SELF_ID,
} from "./fixtures";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

// ---- mutable in-memory state, seeded from the fixtures each page load ----
// real Slack messages always carry type: "message" and the client filters on
// it (loadConversationView), so stamp it here instead of on every fixture.
const messagesByChannel: Record<string, any[]> = Object.fromEntries(
  Object.entries(clone(rawMessagesByChannel)).map(([id, msgs]) => [
    id,
    msgs.map((m) => ({ type: "message", ...m })),
  ]),
);
const mutedChannels = new Set<string>();
const starredChannels = new Set<string>([CH_GENERAL]);
const presence: Record<string, string> = Object.fromEntries(
  Object.values(rawUsers).map((u: any) => [u.id, u.presence ?? "active"]),
);
const topicOverrides: Record<string, string> = {};
const purposeOverrides: Record<string, string> = {};
const nameOverrides: Record<string, string> = {};
const readCursor: Record<string, string> = {};
const drafts = new Map<string, { text: string; channelId: string }>();
const CANVAS_CONTENT =
  "<h1>General canvas</h1><p>This is a mock canvas so the header menu and canvas panel have something to open.</p>";

let messageCounter = 1000;
function nextTs() {
  messageCounter += 1;
  return (Date.now() / 1000 + messageCounter / 1000).toFixed(6);
}

function findMessage(channel: string, ts: string): any | undefined {
  return messagesByChannel[channel]?.find((m) => m.ts === ts);
}

// ---- tiny router ----
type Handler = (params: Record<string, string>, ctx: { search: URLSearchParams; body: any }) => any;
const routes: { method: string; pattern: string; handler: Handler }[] = [];
function on(method: string, pattern: string, handler: Handler) {
  routes.push({ handler, method, pattern });
}
function matchPattern(pattern: string, pathname: string): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const p = patternParts[i];
    if (p.startsWith(":")) params[p.slice(1)] = decodeURIComponent(pathParts[i]);
    else if (p !== pathParts[i]) return null;
  }
  return params;
}

// ---- bootstrap ----
on("GET", "/api/bootstrap", (_params, ctx) => {
  const channels = rawBootChannels.map((c) => ({
    ...c,
    name: nameOverrides[c.id] ?? c.name,
    topic: topicOverrides[c.id] === undefined ? c.topic : { value: topicOverrides[c.id] },
  }));
  const unreadFor = (id: string, mentions: number, unread: boolean) => ({
    id,
    is_unread: unread,
    mention_count: mentions,
  });
  return {
    channel_sections: undefined,
    channels,
    emoji_use: JSON.stringify({}),
    frecency: JSON.stringify({}),
    highlight_words: JSON.stringify([]),
    ims: rawBootIms,
    is_open: rawBootMpims.map((m) => m.id),
    mpims: rawBootMpims,
    muted_channels: [...mutedChannels].join(","),
    notification_prefs: JSON.stringify({ channels: {}, global: {} }),
    notifications: {},
    ok: true,
    self: rawUsers[SELF_ID],
    sections:
      ctx.search.get("sections") === "true"
        ? {
            sec1: {
              channel_ids: [CH_GENERAL, CH_ENG, CH_ANNOUNCE],
              filtering: "all",
              name: "Work",
              type: "standard",
            },
          }
        : undefined,
    snooze: null,
    starred: [...starredChannels],
    subteams: { self: [] },
    unreads: {
      channels: [
        unreadFor(CH_GENERAL, 2, true),
        unreadFor(CH_ANNOUNCE, 1, true),
        unreadFor(CH_RANDOM, 0, false),
        unreadFor(CH_ENG, 0, false),
        unreadFor(CH_ARCHIVE, 0, false),
      ],
      ims: [unreadFor(DM_ALICE, 1, true), unreadFor(DM_BOB, 0, false)],
      mpims: [unreadFor(MPDM, 0, false)],
    },
  };
});

on("GET", "/api/emoji", () => new Response("", { headers: { "content-type": "text/plain" } }));

// ---- conversation view + messages ----
const PAGE_SIZE = 20;
on("GET", "/api/channels/:id/view", (params) => {
  const id = params.id;
  const messages = messagesByChannel[id] ?? [];
  const page = messages.slice(-PAGE_SIZE);
  const channel = rawBootChannels.find((c) => c.id === id) ?? { id, name: id };
  return {
    channel: {
      id,
      is_archived: (channel as any).is_archived,
      is_private: (channel as any).is_private,
      name: nameOverrides[id] ?? (channel as any).name ?? id,
      properties: (channel as any).properties,
      purpose: purposeOverrides[id] ?? "",
      topic: topicOverrides[id] ?? (channel as any).topic,
    },
    history: { has_more: messages.length > PAGE_SIZE, messages: page },
    ok: true,
    users: Object.values(rawUsers),
  };
});

on("GET", "/api/channels/:id/messages", (params, ctx) => {
  const id = params.id;
  const messages = messagesByChannel[id] ?? [];
  const before = ctx.search.get("before");
  const beforeIndex = before ? messages.findIndex((m) => m.ts === before) : messages.length;
  const end = beforeIndex === -1 ? messages.length : beforeIndex;
  const start = Math.max(0, end - PAGE_SIZE);
  return { has_more: start > 0, messages: messages.slice(start, end), ok: true };
});

on("POST", "/api/channels/:id/messages", (params, ctx) => {
  const text = ctx.body?.text ?? "";
  const msg = { blocks: ctx.body?.blocks, text, ts: nextTs(), type: "message", user: SELF_ID };
  messagesByChannel[params.id] ??= [];
  messagesByChannel[params.id].push(msg);
  return { message: msg, ok: true, ts: msg.ts };
});

on("PATCH", "/api/channels/:id/messages/:ts", (params, ctx) => {
  const msg = findMessage(params.id, params.ts);
  if (msg) {
    msg.text = ctx.body?.text ?? msg.text;
    msg.blocks = ctx.body?.blocks;
    msg.edited = true;
  }
  return { message: msg, ok: true };
});

on("DELETE", "/api/channels/:id/messages/:ts", (params) => {
  const list = messagesByChannel[params.id];
  const msg = list?.find((m) => m.ts === params.ts);
  if (msg) msg.deleted = true;
  return { ok: true };
});

on("POST", "/api/channels/:id/read", (params, ctx) => {
  readCursor[params.id] = ctx.body?.ts ?? nextTs();
  return { ok: true };
});
on("GET", "/api/channels/:id/threads/:ts/messages", () => ({
  has_more: false,
  messages: [],
  ok: true,
}));
on("POST", "/api/channels/:id/threads/:ts/read", () => ({ ok: true }));
on("POST", "/api/channels/:id/threads/:ts/subscription", () => ({ ok: true }));
on("DELETE", "/api/channels/:id/threads/:ts/subscription", () => ({ ok: true }));

// ---- reactions / pins / stars / saves ----
on("POST", "/api/messages/:channel/:ts/reactions", (params, ctx) => {
  const msg = findMessage(params.channel, params.ts);
  const name = ctx.body?.name;
  if (msg && name) {
    msg.reactions ??= [];
    const existing = msg.reactions.find((r: any) => r.name === name);
    if (existing) {
      if (!existing.users.includes(SELF_ID)) {
        existing.users.push(SELF_ID);
        existing.count += 1;
      }
    } else msg.reactions.push({ count: 1, name, users: [SELF_ID] });
  }
  return { ok: true };
});
on("DELETE", "/api/messages/:channel/:ts/reactions", (params, ctx) => {
  const msg = findMessage(params.channel, params.ts);
  const name = ctx.body?.name;
  if (msg?.reactions && name) {
    msg.reactions = msg.reactions
      .map((r: any) =>
        r.name === name
          ? { ...r, count: r.count - 1, users: r.users.filter((u: string) => u !== SELF_ID) }
          : r,
      )
      .filter((r: any) => r.count > 0);
  }
  return { ok: true };
});
const pinned = new Set<string>();
on("POST", "/api/messages/:channel/:ts/pin", (params) => {
  pinned.add(`${params.channel}:${params.ts}`);
  return { ok: true };
});
on("DELETE", "/api/messages/:channel/:ts/pin", (params) => {
  pinned.delete(`${params.channel}:${params.ts}`);
  return { ok: true };
});
on("GET", "/api/channels/:id/pins", (params) => ({
  items: [...pinned]
    .filter((key) => key.startsWith(`${params.id}:`))
    .map((key) => {
      const ts = key.split(":")[1];
      return { message: findMessage(params.id, ts), ts };
    }),
  ok: true,
}));
on("POST", "/api/channels/:id/star", (params) => {
  starredChannels.add(params.id);
  return { ok: true };
});
on("DELETE", "/api/channels/:id/star", (params) => {
  starredChannels.delete(params.id);
  return { ok: true };
});
on("POST", "/api/messages/:channel/:ts/save", () => ({ ok: true }));
on("DELETE", "/api/messages/:channel/:ts/save", () => ({ ok: true }));
on("GET", "/api/saved", () => ({ items: [], ok: true }));

// ---- channel details ----
on("PATCH", "/api/channels/:id", (params, ctx) => {
  nameOverrides[params.id] = ctx.body?.name ?? params.id;
  return { ok: true };
});
on("PUT", "/api/channels/:id/topic", (params, ctx) => {
  topicOverrides[params.id] = ctx.body?.topic ?? "";
  return { ok: true };
});
on("PUT", "/api/channels/:id/purpose", (params, ctx) => {
  purposeOverrides[params.id] = ctx.body?.purpose ?? "";
  return { ok: true };
});
on("GET", "/api/channels/:id/managers", () => ({ managerIds: [SELF_ID], ok: true }));
on("GET", "/api/channels/:id/members", () => ({ members: Object.keys(rawUsers), ok: true }));
on("GET", "/api/channels/:id/posting-prefs", () => ({ ok: true, postingPrefs: null }));
on("PUT", "/api/channels/:id/posting-prefs", () => ({ ok: true }));
on("PUT", "/api/channels/:id/retention", () => ({ ok: true }));
on("PUT", "/api/channels/:id/member-permissions", () => ({ ok: true }));
on("PUT", "/api/channels/:id/notifications", () => ({ ok: true }));
on("GET", "/api/channels/:id/files-links", () => ({ files: [], links: [], ok: true }));
on("GET", "/api/channels/browse", () => ({ channels: [], ok: true }));
on("POST", "/api/channels/lookup", () => ({ channels: [], ok: true }));

// ---- canvases ----
on("GET", "/api/canvases/:id/file-info", () => ({
  ok: true,
  title: "General canvas",
  url_private_download: "/api/mock-canvas-content",
}));
on(
  "GET",
  "/api/mock-canvas-content",
  () => new Response(CANVAS_CONTENT, { headers: { "content-type": "text/html" } }),
);

// ---- presence ----
on("GET", "/api/users/:id/presence", (params) => ({
  ok: true,
  presence: presence[params.id] ?? "active",
}));
on("PUT", "/api/presence", (_params, ctx) => {
  presence[SELF_ID] = ctx.body?.presence === "away" ? "away" : "active";
  return { ok: true };
});
on("GET", "/api/users/:id/profile", (params) => ({ ok: true, user: rawUsers[params.id] }));
on("POST", "/api/users/lookup", (_params, ctx) => {
  const ids: string[] = ctx.body?.userIds ?? [];
  return { ok: true, users: ids.map((id) => rawUsers[id]).filter(Boolean) };
});
on("GET", "/api/user-status/:id", () => ({ ok: true, status: null }));
on("PUT", "/api/profile", () => ({ ok: true }));

// ---- preferences ----
on("PUT", "/api/preferences/muted-channels", (_params, ctx) => {
  mutedChannels.clear();
  for (const id of ctx.body?.channelIds ?? []) mutedChannels.add(id);
  return { ok: true };
});
on("PUT", "/api/preferences/highlight-words", () => ({ ok: true }));
on("PUT", "/api/preferences/theme-colors", () => ({ ok: true }));
on("PUT", "/api/preferences/theme-shape", () => ({ ok: true }));
on("PUT", "/api/preferences/channel-sections", () => ({ ok: true }));
on("GET", "/api/sections", () => ({ ok: true, sections: {} }));

// ---- activity ----
on("GET", "/api/activity", () => ({ items: rawActivityItems, ok: true, response_metadata: {} }));
on("GET", "/api/activity/counts", () => ({ activityCounts: {}, ok: true }));
on("POST", "/api/activity/read", () => ({ ok: true }));

// ---- search ----
on("GET", "/api/search", (_params, ctx) => {
  const query = (ctx.search.get("query") ?? "").toLowerCase();
  const channels = rawBootChannels.filter((c) => c.name?.includes(query));
  return { channels, files: [], ok: true, users: [] };
});
on("GET", "/api/search/messages", (_params, ctx) => {
  const query = (ctx.search.get("query") ?? "").toLowerCase();
  const results: any[] = [];
  for (const [channelId, list] of Object.entries(messagesByChannel)) {
    for (const m of list) {
      if (m.text?.toLowerCase().includes(query)) {
        results.push({ channelId, channelName: channelId, text: m.text, ts: m.ts, userId: m.user });
      }
    }
  }
  return { ok: true, results };
});
on("GET", "/api/search/autocomplete", () => ({ ok: true, suggestions: [] }));
on("POST", "/api/search/save", () => ({ ok: true }));

// ---- drafts ----
on("GET", "/api/drafts", () => ({ drafts: [...drafts.values()], ok: true }));
on("PUT", "/api/drafts", (_params, ctx) => {
  const id = ctx.body?.channelId ?? "draft";
  drafts.set(id, { channelId: id, text: ctx.body?.text ?? "" });
  return { ok: true };
});
on("DELETE", "/api/drafts/:id", (params) => {
  drafts.delete(params.id);
  return { ok: true };
});

// ---- misc lists ----
on("GET", "/api/commands", () => ({ commands: [], ok: true }));
on("GET", "/api/directory", () => ({ ok: true, users: Object.values(rawUsers) }));
on("GET", "/api/message-shortcuts", () => ({ ok: true, shortcuts: [] }));
on("GET", "/api/profile-fields", () => ({ fields: [], ok: true }));
on("GET", "/api/apps/:id/profile", () => ({ description: "", ok: true }));
on("GET", "/api/bots/:id", () => ({ bot: null, ok: true }));
on("POST", "/api/dms", (_params, ctx) => {
  const userId = ctx.body?.userId;
  return { ok: true, channelId: userId === "U_EVE" ? DM_ALICE : DM_ALICE };
});
on("POST", "/api/channels/:id/join", () => ({ ok: true }));
on("POST", "/api/channels/:id/leave", () => ({ ok: true }));
on("POST", "/api/channels/:id/archive", () => ({ ok: true }));
on("POST", "/api/channels/:id/unarchive", () => ({ ok: true }));
on("POST", "/api/channels/:id/close", () => ({ ok: true }));

async function handleMock(pathname: string, method: string, search: URLSearchParams, body: any) {
  for (const route of routes) {
    if (route.method !== method) continue;
    const params = matchPattern(route.pattern, pathname);
    if (!params) continue;
    const result = await route.handler(params, { body, search });
    if (result instanceof Response) return result;
    return Response.json(result ?? { ok: true });
  }
  // Unhandled endpoint: soft-fail so one missing route doesn't break
  // everything else - most call sites already treat a missing field as
  // "empty" via `?? []` / `?? undefined`.
  console.debug("[mock] unhandled", method, pathname);
  return Response.json({ ok: true });
}

export function installMock() {
  document.cookie =
    "slock_info=%7B%22domain%22%3A%22mock.slack.com%22%2C%22teamId%22%3A%22T_MOCK%22%7D; path=/";

  const realFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (!url.startsWith("/api/")) return realFetch(input, init);
    const parsed = new URL(url, location.origin);
    let body: any;
    const rawBody = init?.body;
    if (typeof rawBody === "string") {
      try {
        body = JSON.parse(rawBody);
      } catch {
        body = rawBody;
      }
    }
    return handleMock(
      parsed.pathname,
      (init?.method ?? "GET").toUpperCase(),
      parsed.searchParams,
      body,
    );
  };

  class MockWebSocket extends EventTarget {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    readyState = MockWebSocket.CONNECTING;
    onopen: ((ev: Event) => void) | null = null;
    onmessage: ((ev: MessageEvent) => void) | null = null;
    onclose: ((ev: Event) => void) | null = null;
    onerror: ((ev: Event) => void) | null = null;

    constructor(_url: string) {
      super();
      setTimeout(() => {
        this.readyState = MockWebSocket.OPEN;
        this.dispatchEvent(new Event("open"));
        this.onopen?.(new Event("open"));
        this.deliver({ connected: true, type: "_status" });
      }, 80);
    }
    deliver(payload: unknown) {
      const ev = new MessageEvent("message", { data: JSON.stringify(payload) });
      this.dispatchEvent(ev);
      this.onmessage?.(ev);
    }
    send() {
      // Real-time push (presence_sub, watch_channel, etc) is a no-op here -
      // this mock only serves static/interactive-mutation data, not a live
      // gateway. Sidebar/composer/reaction interactions still work since
      // those go through the fetch mock above and update local state.
    }
    close() {
      this.readyState = MockWebSocket.CLOSED;
      this.dispatchEvent(new Event("close"));
      this.onclose?.(new Event("close"));
    }
  }
  // @ts-expect-error - intentionally replacing the global for offline testing
  window.WebSocket = MockWebSocket;

  console.info("[mock] offline test mode installed - see packages/app/src/mock/README.md");
}
