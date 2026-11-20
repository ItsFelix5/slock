import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import { createFakeEnv } from "@slock/core/testing";
import { isChannelId } from "@slock/slack";
import { ch, uid } from "@slock/slack/testing";
import type { ChannelId, GatewayEvent, Message, Ts, User } from "@slock/types";
import { createMemo, createRoot, createSignal, createStore, flush } from "solid-js";
import type { View } from "../../../../src/conversations/client/api/types";
import type { ThreadRef } from "../../../../src/messages/client/api";
import { createMessageEvents } from "../../../../src/messages/client/store/events";
import { createMessagesStore } from "../../../../src/messages/client/store/index";
import querySetup from "../../../../src/query/client/index";
import { createFeedback } from "../../../../src/shell/client/feedback";
import { createFakeSlack } from "./fakeSlack";

export const ME = uid("UME");
export const OTHER = uid("UOTHER");

const me: User = { avatarColor: "#000", id: ME, name: "me" };

export const settle = async () => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};

export async function createStoreHarness() {
  const env = createFakeEnv();
  const slack = createFakeSlack(ME, env);
  const realFetch = globalThis.fetch;
  globalThis.fetch = Object.assign(
    (input: RequestInfo | URL, init?: RequestInit) => env.fetch(input, init),
    {
      preconnect: realFetch.preconnect,
    },
  );
  const host = createHost({ env, reactive: solidReactive });
  setHost(host);
  await host.register(
    { id: "feedback", setup: (ctx) => ctx.provide("feedback", createFeedback()) },
    { id: "query", setup: querySetup },
  );

  const [unread, setUnreadFlags] = createStore<Record<ChannelId, boolean>>({});
  const setUnread = (id: ChannelId, flag: boolean) =>
    setUnreadFlags((s) => {
      s[id] = flag;
    });
  const patchedChannels: ChannelId[] = [];
  const deleted: string[] = [];
  const closedDms: Record<ChannelId, boolean> = {};
  const [views, setViews] = createSignal<View[]>([]);
  const [threads, setThreads] = createSignal<ThreadRef[]>([]);
  const members = new Set<ChannelId>(["C1", "C2", "C3", "C4", "C5", "C6"].map(ch));

  let dispose = () => {};
  const { events, store } = createRoot((stop) => {
    dispose = stop;
    const currentUser = createMemo(() => me);
    const store = createMessagesStore({
      clearChannelUnread: (id) => setUnread(id, false),
      currentUser,
      extendPatch: () => ({}),
      lastReadFor: () => undefined,
      onMessageDeleted: (channel, ts) => deleted.push(`${channel}:${ts}`),
      retainsDeleted: () => false,
      setChannelRead: () => Promise.resolve(true),
      setLastReadByChannel: () => {},
      setThreadRead: () => Promise.resolve(true),
      setUnreadChannelIds: (id, flag) => setUnread(id, flag),
      setUnreadDividerTs: () => {},
      syncChannelRead: () => Promise.resolve(true),
      threadReadTsFor: () => undefined,
      unreadDividerTsFor: () => undefined,
      visibleMessageTargets: () => [],
      visibleThreads: threads,
      visibleViews: views,
    });
    const events = createMessageEvents(store, {
      channels: {
        isChannelMember: (id) => members.has(id),
        patchChannel: (id) => {
          patchedChannels.push(id);
        },
      },
      conversations: { mountedViews: views },
      dms: {
        closedDmIds: closedDms,
        dmById: () => undefined,
        ensureDm: () => {},
        setClosedDmIds: () => {},
      },
      unread: {
        isViewed: (id) => views().some((view) => view.id === id),
        setUnreadChannelIds: setUnread,
      },
      users: { currentUser },
    });
    return { events, store };
  });

  const deliver = (event: GatewayEvent) => {
    for (const handler of events.handlers)
      if (handler.types.includes(event.type)) handler.run(event);
    flush();
  };

  return {
    deleted,
    deliver,
    dispose() {
      globalThis.fetch = realFetch;
      dispose();
      return host.stop();
    },
    messages: (channel: ChannelId): Message[] => {
      flush();
      return [...(store.messagesByChannel[channel] ?? [])];
    },
    onReconnect: events.onReconnect,
    open(...ids: ChannelId[]) {
      setViews(ids.map((id) => ({ id, kind: "channel" })));
    },
    openThread(thread: ThreadRef) {
      setThreads([thread]);
    },
    env,
    slack,
    store,
    thread: (ts: Ts): Message[] => {
      flush();
      return [...(store.threadMessages[ts] ?? [])];
    },
    unreadChannels: () => {
      flush();
      return Object.keys(unread)
        .filter(isChannelId)
        .filter((id) => unread[id]);
    },
  };
}

export type StoreHarness = Awaited<ReturnType<typeof createStoreHarness>>;
