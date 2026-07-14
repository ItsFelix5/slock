// biome-ignore-all lint/performance/noBarrelFile: These re-exports form this slice's public API.
import type { ActivityItem, Message, User } from "@slock/slack-api";
import {
  broadcastReply,
  deleteMessage,
  editMessage,
  postMessage,
  toggleReaction,
} from "@slock/slack-api";
import { produce } from "solid-js/store";
import { actionFeedback } from "../feedback";
import type { MessageLocation, ThreadRef, View } from "../types";
import { createMessageHistory } from "./messageHistory";
import { copyMessageLink, prepareReplyLink, remindAboutMessage } from "./messageLinks";
import { findMessageLocations } from "./messageLocations";
import { createMessageMergeActions } from "./messageMergeActions";
import { createMessageStatusActions } from "./messageStatusActions";

export { REMINDER_OPTIONS } from "./messageLinks";
export { mergeMessages } from "./messageMerge";

export function createMessagesSlice(deps: {
  currentUser: () => User | undefined;
  pushActivity: (item: ActivityItem) => void;
  clearChannelUnread: (channelId: string) => void;
  setLastReadByChannel: (channelId: string, ts: number) => void;
  setUnreadDividerTs: (channelId: string, ts: number) => void;
  setUnreadChannelIds: (channelId: string, unread: boolean) => void;
  activeView: () => View | null;
  activeThread: () => ThreadRef | null;
}) {
  const history = createMessageHistory({
    activeThread: deps.activeThread,
    activeView: deps.activeView,
  });
  const {
    messagesByChannel,
    setMessagesByChannel,
    loadedChannels,
    threadMessages,
    setThreadMessages,
    loadedThreads,
    loadOlderMessages,
    hasMoreHistory,
    isLoadingHistory,
  } = history;
  const statusActions = createMessageStatusActions({
    clearChannelUnread: deps.clearChannelUnread,
    messagesByChannel,
    patchMessage: (channelId, ts, patch) => patchMessage(channelId, ts, patch),
    setLastReadByChannel: deps.setLastReadByChannel,
    setUnreadChannelIds: deps.setUnreadChannelIds,
    setUnreadDividerTs: deps.setUnreadDividerTs,
    threadMessages,
  });
  const mergeActions = createMessageMergeActions({
    currentUser: deps.currentUser,
    setMessagesByChannel: (channelId, update) => setMessagesByChannel(channelId, update),
  });
  const findAllMessageLocations = (channelId: string, ts: string) =>
    findMessageLocations(messagesByChannel, threadMessages, channelId, ts);
  function patchMessage(channelId: string, ts: string, patch: Partial<Message>) {
    for (const { location } of findAllMessageLocations(channelId, ts)) {
      if (location.store === "channel") {
        setMessagesByChannel(
          location.key,
          produce((list) => {
            const msg = list.find((m) => m.ts === ts);
            if (msg) Object.assign(msg, patch);
          }),
        );
      } else {
        setThreadMessages(
          location.key,
          produce((list) => {
            const msg = list.find((m) => m.ts === ts);
            if (msg) Object.assign(msg, patch);
          }),
        );
      }
    }
  }
  function removeMessage(location: MessageLocation, ts: string) {
    const remove = (list: Message[]) => {
      const idx = list.findIndex((m) => m.ts === ts);
      if (idx !== -1) list.splice(idx, 1);
    };
    if (location.store === "channel") {
      setMessagesByChannel(location.key, produce(remove));
    } else {
      setThreadMessages(location.key, produce(remove));
    }
  }
  function applyReactionEvent(
    channel: string,
    ts: string,
    name: string,
    userId: string,
    added: boolean,
  ) {
    const locations = findAllMessageLocations(channel, ts);
    if (locations.length === 0) return;
    const msg = locations[0].list.find((m) => m.ts === ts);
    if (!msg) return;
    const reactions = msg.reactions ?? [];
    const existing = reactions.find((r) => r.name === name);
    let next: typeof reactions;
    if (added) {
      next = existing
        ? reactions.map((r) =>
            r.name === name ? { ...r, count: r.count + 1, users: [...r.users, userId] } : r,
          )
        : [...reactions, { count: 1, name, users: [userId] }];
    } else if (existing) {
      next = reactions
        .map((r) =>
          r.name === name
            ? { ...r, count: r.count - 1, users: r.users.filter((u) => u !== userId) }
            : r,
        )
        .filter((r) => r.count > 0);
    } else {
      next = reactions;
    }
    patchMessage(channel, ts, { reactions: next });
    const me = deps.currentUser();
    if (added && me && msg.userId === me.id && userId !== me.id) {
      deps.pushActivity({
        channelId: channel,
        id: `rx-${channel}-${ts}-${name}-${userId}-${Date.now()}`,
        kind: "reaction",
        reactionName: name,
        text: msg.text,
        time: Date.now(),
        ts,
        userId,
      });
    }
  }
  async function sendMessage(
    channelId: string,
    text: string,
    threadTs?: string,
    blocks?: unknown,
    suppressUnfurl?: boolean,
  ) {
    const trimmed = text.trim();
    if (!(trimmed || blocks)) return;
    const me = deps.currentUser();
    const now = Date.now();
    const optimistic: Message = {
      blocks: blocks as Message["blocks"],
      day: "Today",
      id: `pending-${now}`,
      kind: "normal",
      text: trimmed,
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      ts: String(now / 1000),
      userId: me?.id ?? "",
    };
    const key = threadTs ?? channelId;
    const location: MessageLocation = threadTs
      ? { key, store: "thread" }
      : { key, store: "channel" };
    if (threadTs) {
      setThreadMessages(
        produce((draft) => {
          if (!draft[key]) draft[key] = [];
          draft[key].push(optimistic);
        }),
      );
    } else {
      setMessagesByChannel(
        produce((draft) => {
          if (!draft[key]) draft[key] = [];
          draft[key].push(optimistic);
        }),
      );
    }
    try {
      const res = await postMessage(channelId, trimmed, threadTs, blocks, suppressUnfurl);
      const realTs = res.ts as string;
      const resolvePending = (list: Message[]) =>
        list.some((m) => m.id !== optimistic.id && (m.ts === realTs || m.id === realTs))
          ? list.filter((m) => m.id !== optimistic.id)
          : list.map((m) => (m.id === optimistic.id ? { ...m, id: realTs, ts: realTs } : m));
      if (location.store === "channel") {
        setMessagesByChannel(location.key, resolvePending);
      } else {
        setThreadMessages(location.key, resolvePending);
      }
    } catch (err) {
      console.error("Failed to send message", err);
      actionFeedback.flash(key, "Failed to send.", "error");
      removeMessage(location, optimistic.ts);
    }
  }
  async function editMessageText(channelId: string, ts: string, text: string, blocks?: unknown) {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      await editMessage(channelId, ts, trimmed, blocks);
      patchMessage(channelId, ts, {
        blocks: blocks as Message["blocks"],
        edited: true,
        text: trimmed,
      });
    } catch (err) {
      console.error("Failed to edit message", err);
      actionFeedback.flash(ts, "Failed to edit message.", "error");
    }
  }
  async function broadcastThreadReply(channelId: string, ts: string) {
    patchMessage(channelId, ts, { isBroadcast: true });
    try {
      await broadcastReply(channelId, ts);
      const broadcasted = findAllMessageLocations(channelId, ts)[0]?.list.find((m) => m.ts === ts);
      if (broadcasted && loadedChannels.has(channelId))
        mergeActions.insertMessageInOrder(channelId, broadcasted);
    } catch (err) {
      console.error("Failed to broadcast reply", err);
      actionFeedback.flash(ts, "Failed to send to channel.", "error");
      patchMessage(channelId, ts, { isBroadcast: false });
    }
  }
  async function deleteMessageAt(channelId: string, ts: string) {
    try {
      await deleteMessage(channelId, ts);
      patchMessage(channelId, ts, { deleted: true });
    } catch (err) {
      console.error("Failed to delete message", err);
      actionFeedback.flash(ts, "Failed to delete message.", "error");
    }
  }
  async function reactToMessage(channelId: string, msg: Message, emojiName: string) {
    const me = deps.currentUser();
    if (!me) return;
    const previousReactions = msg.reactions;
    const reactions = previousReactions ?? [];
    const existing = reactions.find((r) => r.name === emojiName);
    const alreadyReacted = !!existing?.users.includes(me.id);
    let nextReactions: typeof reactions;
    if (alreadyReacted) {
      nextReactions = reactions
        .map((r) =>
          r.name === emojiName
            ? { ...r, count: r.count - 1, users: r.users.filter((u) => u !== me.id) }
            : r,
        )
        .filter((r) => r.count > 0);
    } else if (existing) {
      nextReactions = reactions.map((r) =>
        r.name === emojiName ? { ...r, count: r.count + 1, users: [...r.users, me.id] } : r,
      );
    } else {
      nextReactions = [...reactions, { count: 1, name: emojiName, users: [me.id] }];
    }
    patchMessage(channelId, msg.ts, { reactions: nextReactions });
    try {
      await toggleReaction(channelId, msg.ts, emojiName, alreadyReacted);
    } catch (err) {
      console.error("Failed to toggle reaction", err);
      patchMessage(channelId, msg.ts, { reactions: previousReactions });
    }
  }
  return {
    findAllMessageLocations,
    hasMoreHistory,
    isLoadingHistory,
    loadedChannels,
    loadedThreads,
    loadOlderMessages,
    messagesByChannel,
    patchMessage,
    removeMessage,
    setMessagesByChannel,
    setThreadMessages,
    threadMessages,
    ...mergeActions,
    applyReactionEvent,
    broadcastThreadReply,
    deleteMessageAt,
    editMessageText,
    reactToMessage,
    sendMessage,
    ...statusActions,
    copyMessageLink,
    prepareReplyLink,
    remindAboutMessage,
  };
}
