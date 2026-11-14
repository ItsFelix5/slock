import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import type { GatewayEvent, Message, User } from "@slock/types";
import { QueryClient } from "@tanstack/solid-query";
import { createRoot, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import type { View } from "../../../../src/conversations/client/api/types";
import type { ThreadRef } from "../../../../src/messages/client/api";
import { createMessageEvents } from "../../../../src/messages/client/store/events";
import { createMessagesStore } from "../../../../src/messages/client/store/index";
import { createFeedback } from "../../../../src/shell/client/feedback";
import { createFakeSlack } from "./fakeSlack";

export const ME = "UME";
export const OTHER = "UOTHER";

const me: User = { avatarColor: "#000", id: ME, name: "me" };

export const settle = async () => {
  for (let i = 0; i < 20; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

export async function createStoreHarness() {
  const slack = createFakeSlack(ME);
  const host = createHost({ reactive: solidReactive });
  setHost(host);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await host.register(
    { id: "feedback", setup: (ctx) => ctx.provide("feedback", createFeedback()) },
    { id: "query", setup: (ctx) => ctx.provide("query", { client: queryClient }) },
  );

  const [unread, setUnread] = createStore<Record<string, boolean>>({});
  const patchedChannels: string[] = [];
  const deleted: string[] = [];
  const closedDms: Record<string, boolean> = {};
  const [views, setViews] = createSignal<View[]>([]);
  const [threads, setThreads] = createSignal<ThreadRef[]>([]);
  const members = new Set<string>(["C1", "C2", "C3", "C4", "C5", "C6"]);

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
      conversations: { visibleViews: views },
      dms: {
        closedDmIds: closedDms,
        dmById: () => undefined,
        ensureDm: () => {},
        setClosedDmIds: () => {},
      },
      unread: { setUnreadChannelIds: setUnread },
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
      slack.restore();
      return host.stop();
    },
    messages: (channel: string): Message[] => [...(store.messagesByChannel[channel] ?? [])],
    onReconnect: events.onReconnect,
    open(...ids: string[]) {
      setViews(ids.map((id) => ({ id, kind: "channel" })));
    },
    openThread(thread: ThreadRef) {
      setThreads([thread]);
    },
    slack,
    store,
    thread: (ts: string): Message[] => [...(store.threadMessages[ts] ?? [])],
    unreadChannels: () => Object.keys(unread).filter((id) => unread[id]),
  };
}

export type StoreHarness = Awaited<ReturnType<typeof createStoreHarness>>;
