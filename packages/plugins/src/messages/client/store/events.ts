import type { Services } from "@slock/core/types";
import { gatewayHandler } from "../../../realtime/client/api";
import { createIncomingMessageHandler } from "./incomingMessages";
import type { createMessagesStore } from "./index";

type Messages = ReturnType<typeof createMessagesStore>;

export function createMessageEvents(
  messages: Messages,
  deps: {
    channels: Services["channels"];
    dms: Services["dms"];
    conversations: Services["conversations"];
    unread: Services["unread"];
    users: Services["users"];
  },
) {
  const { channels, conversations, dms, unread, users } = deps;
  const handleIncomingMessage = createIncomingMessageHandler({
    closedDmIds: dms.closedDmIds,
    currentUser: users.currentUser,
    dmById: dms.dmById,
    ensureDm: dms.ensureDm,
    findAllMessageLocations: messages.findAllMessageLocations,
    insertMessageInOrder: messages.realtimeHooks.insertMessageInOrder,
    isChannelMember: channels.isChannelMember,
    isThreadKnown: messages.isThreadKnown,
    loadedChannels: messages.loadedChannels,
    mergeIncomingMessage: messages.realtimeHooks.mergeIncomingMessage,
    patchChannel: channels.patchChannel,
    patchMessage: messages.patchMessage,
    markDeleted: messages.markDeleted,
    setClosedDmIds: dms.setClosedDmIds,
    setMessagesByChannel: messages.setMessagesByChannel,
    setThreadMessages: messages.setThreadMessages,
    setUnreadChannelIds: unread.setUnreadChannelIds,
    threadMessages: messages.threadMessages,
    visibleViews: conversations.visibleViews,
  });

  const handlers = [
    gatewayHandler(["message"], handleIncomingMessage),
    gatewayHandler(["reaction_added", "reaction_removed"], (event) => {
      if (!(event.item.channel && event.item.ts && event.reaction && event.user)) return;
      if (event.user === users.currentUser()?.id) return;
      messages.realtimeHooks.applyReactionEvent(
        event.item.channel,
        event.item.ts,
        event.reaction,
        event.user,
        event.type === "reaction_added",
      );
    }),
    gatewayHandler(["thread_subscribed", "thread_unsubscribed"], (event) => {
      if (event.channel && event.thread_ts)
        messages.patchMessage(event.channel, event.thread_ts, {
          isSubscribed: event.type === "thread_subscribed",
        });
    }),
  ];

  function onReconnect() {
    const visibleIds = new Set(conversations.visibleViews().map((view) => view.id));
    for (const channel of messages.loadedChannels) {
      if (visibleIds.has(channel)) messages.loadRecentHistory(channel);
      else messages.loadedChannels.delete(channel);
    }
    for (const thread of messages.visibleThreads()) messages.refreshThreadReplies(thread.ts);
  }

  return { handlers, onReconnect };
}
