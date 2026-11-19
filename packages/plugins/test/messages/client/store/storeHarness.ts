import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import { createFakeEnv } from "@slock/core/testing";
import { ch, uid } from "@slock/slack/testing";
import type { ChannelId, GatewayEvent, Message, Ts, User } from "@slock/types";
import { QueryClient } from "@tanstack/solid-query";
import { createRoot, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import type { View } from "../../../../src/conversations/client/api/types";
import type { ThreadRef } from "../../../../src/messages/client/api";
import { createMessageEvents } from "../../../../src/messages/client/store/events";
import { createMessagesStore } from "../../../../src/messages/client/store/index";
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
  const host = createHost({ env, reactive: solidReactive });
  setHost(host);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await host.register(
    { id: "feedback", setup: (ctx) => ctx.provide("feedback", createFeedback()) },
    { id: "query", setup: (ctx) => ctx.provide("query", { client: queryClient }) },
  );

  const [unread, setUnread] = createStore<Record<ChannelId, boolean>>({});
  const patchedChannels: ChannelId[] = [];
  const deleted: string[] = [];
  const closedDms: Record<ChannelId, boolean> = {};
  const [views, setViews] = createSignal<View[]>([]);
  const [threads, setThreads] = createSignal<ThreadRef[]>([]);
  const members = new Set<ChannelId>(["C1", "C2", "C3", "C4", "C5", "C6"].map(ch));

  let dispose = () => {};
  const { events, store } = createRoot((stop) => {
    dispose = stop;
    const store = createMessagesStore({
      clearChannelUnread: (id) => setUnread(id, false),
      currentUser: () => me,
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
      users: { currentUser: () => me },
    });
    return { events, store };
  });

  const deliver = (event: GatewayEvent) => {
    for (const handler of events.handlers)
      if (handler.types.includes(event.type)) handler.run(event);
  };

  return {
    deleted,
    deliver,
    dispose() {
      dispose();
      return host.stop();
    },
    messages: (channel: ChannelId): Message[] => [...(store.messagesByChannel[channel] ?? [])],
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
    thread: (ts: Ts): Message[] => [...(store.threadMessages[ts] ?? [])],
    unreadChannels: () => Object.keys(unread).filter((id) => unread[id]),
  };
}

export type StoreHarness = Awaited<ReturnType<typeof createStoreHarness>>;
