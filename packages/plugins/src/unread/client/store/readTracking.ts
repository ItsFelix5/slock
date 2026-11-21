import type { ChannelId, Message, Ts } from "@slock/types";
import { createEffect, untrack } from "solid-js";
import type { View } from "../../../conversations/client/api/types";
import type { ThreadRef } from "../../../messages/client/api";
import { isPendingMessage } from "../../../messages/client/api/messageMerge";
import {
  type ChannelSnapshot,
  channelReadPlan,
  type DividerStep,
  dividerStep,
  type LatestMessage,
  type ThreadSnapshot,
  threadReadPlan,
} from "./readDecisions";

export type ReadTrackingInput = {
  visibleViews: () => View[];
  messagesByChannel: Record<string, Message[]>;
  visibleThreads: () => ThreadRef[];
  threadMessages: Record<string, Message[]>;
  hasNewerHistory: (channelId: ChannelId) => boolean;
};

export type ReadTrackingDeps = {
  clearChannelUnread: (channelId: ChannelId) => void;
  countsMayChange: Set<string>;
  isThreadUnread: (root: Message) => boolean;
  isViewed: (id: ChannelId | Ts) => boolean;
  lastReadByChannel: Record<string, number | undefined>;
  lastReadSeeded: () => boolean;
  setLastReadByChannel: (channelId: ChannelId, ms: number) => void;
  setThreadReadTs: (threadTs: Ts, ts: Ts | undefined) => void;
  setUnreadDividerTs: (channelId: ChannelId, anchor: number | undefined) => void;
  syncChannelRead: (channelId: ChannelId, ts: Ts) => Promise<boolean>;
  syncThreadRead: (channelId: ChannelId, threadTs: Ts, ts: Ts) => Promise<boolean>;
  threadKey: (channelId: ChannelId, threadTs: Ts) => string;
  unreadChannelIds: Record<string, boolean>;
  unreadDividerTs: Record<string, number | undefined>;
};

function latestOf(list: Message[] | undefined, skipDeleted: boolean): LatestMessage | undefined {
  const message = skipDeleted ? list?.findLast((m) => !m.deleted) : list?.at(-1);
  return message && { pending: isPendingMessage(message), ts: message.ts };
}

export function wireReadTracking(deps: ReadTrackingDeps, input: ReadTrackingInput) {
  const lastMarkedRead = new Map<ChannelId, Ts>();
  const lastMarkedThreadRead = new Map<Ts, Ts>();

  createEffect(
    (prev?: DividerStep) => {
      const views = input.visibleViews();
      return dividerStep(
        prev?.tracker,
        new Set(views.map((v) => v.id)),
        deps.lastReadSeeded()
          ? views.map(({ id }) => ({
              hasNewer: input.hasNewerHistory(id),
              id,
              lastRead: deps.lastReadByChannel[id] ?? 0,
              latest: latestOf(input.messagesByChannel[id], false),
            }))
          : [],
      );
    },
    ({ anchors, dropped }) => {
      for (const [id, anchor] of anchors) deps.setUnreadDividerTs(id, anchor);
      for (const id of dropped) deps.setUnreadDividerTs(id, undefined);
    },
  );

  createEffect(
    (): ChannelSnapshot[] =>
      input.visibleViews().map(({ id }) => ({
        hasDivider: deps.unreadDividerTs[id] !== undefined,
        hasList: !!input.messagesByChannel[id],
        hasNewer: input.hasNewerHistory(id),
        id,
        lastRead: deps.lastReadByChannel[id],
        latest: latestOf(input.messagesByChannel[id], false),
        unread: !!deps.unreadChannelIds[id],
        viewed: deps.isViewed(id),
      })),
    (snapshots) =>
      void untrack(() => {
        for (const view of snapshots) markChannelRead(view);
      }),
  );

  function markChannelRead(view: ChannelSnapshot) {
    const { id } = view;
    const plan = channelReadPlan(view, lastMarkedRead.get(id));
    if (!plan) return;
    const { mark } = plan;
    if (mark) lastMarkedRead.set(id, mark.ts);
    if (plan.clear) deps.clearChannelUnread(id);
    if (!mark?.syncMs) return;
    deps.setLastReadByChannel(id, mark.syncMs);
    void deps.syncChannelRead(id, mark.ts).then((synced) => {
      if (!synced && lastMarkedRead.get(id) === mark.ts) lastMarkedRead.delete(id);
    });
  }

  createEffect(
    (): ThreadSnapshot[] =>
      input.visibleThreads().map(({ channelId, ts }) => {
        const list = input.threadMessages[ts];
        return {
          channelId,
          latest: latestOf(list, true),
          root: list?.find((m) => m.ts === ts),
          ts,
          viewed: deps.isViewed(ts),
        };
      }),
    (snapshots) =>
      void untrack(() => {
        for (const thread of snapshots) markThreadRead(thread);
      }),
  );

  function markThreadRead(thread: ThreadSnapshot) {
    const { channelId, ts } = thread;
    const plan = threadReadPlan(thread, lastMarkedThreadRead.get(ts));
    if (!plan) return;
    lastMarkedThreadRead.set(ts, plan.markTs);
    if (deps.isThreadUnread(plan.root)) deps.countsMayChange.add(deps.threadKey(channelId, ts));
    deps.setThreadReadTs(ts, plan.markTs);
    void deps.syncThreadRead(channelId, ts, plan.markTs).then((synced) => {
      if (!synced && lastMarkedThreadRead.get(ts) === plan.markTs) lastMarkedThreadRead.delete(ts);
    });
  }
}
