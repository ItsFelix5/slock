import type { Services } from "@slock/core/types";
import { createConcurrencyQueue } from "@slock/ui";
import { gatewayHandler } from "../../../realtime/client/api";
import { createIncomingMessageHandler } from "./incomingMessages";
import type { createMessagesStore } from "./index";

const CATCH_UP_CONCURRENCY = 4;
const MIN_CATCH_UP_DOWNTIME_MS = 5000;

type Messages = ReturnType<typeof createMessagesStore>;

export function createMessageEvents(
  messages: Messages,
  deps: {
    channels: Pick<Services["channels"], "isChannelMember" | "patchChannel">;
    dms: Pick<Services["dms"], "closedDmIds" | "dmById" | "ensureDm" | "setClosedDmIds">;
    conversations: Pick<Services["conversations"], "visibleViews">;
    unread: Pick<Services["unread"], "setUnreadChannelIds">;
    users: Pick<Services["users"], "currentUser">;
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
    acceptsLiveReplies: messages.acceptsLiveReplies,
    tracksLatest: (channelId) =>
      messages.loadedChannels.has(channelId) && !messages.hasNewerHistory(channelId),
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
      messages.realtimeHooks.applyReactionEvent(
        event.item.channel,
        event.item.ts,
        event.reaction,
        event.user,
        event.type === "reaction_added",
      );
    }),
    gatewayHandler(
      [
        "channel_history_changed",
        "group_history_changed",
        "im_history_changed",
        "mpim_history_changed",
      ],
      (event) => {
        if (event.channel && messages.loadedChannels.has(event.channel))
          messages.loadRecentHistory(event.channel);
      },
    ),
    gatewayHandler(["thread_subscribed", "thread_unsubscribed"], (event) => {
      if (event.channel && event.thread_ts)
        messages.patchMessage(event.channel, event.thread_ts, {
          isSubscribed: event.type === "thread_subscribed",
        });
    }),
  ];

  const catchUpQueue = createConcurrencyQueue(CATCH_UP_CONCURRENCY);

  function onReconnect({ downMs }: { downMs: number }) {
    if (downMs < MIN_CATCH_UP_DOWNTIME_MS) return;
    const visibleIds = new Set(conversations.visibleViews().map((view) => view.id));
    for (const channel of messages.loadedChannels) {
      if (visibleIds.has(channel))
        void catchUpQueue.run(async () => messages.loadRecentHistory(channel));
      else messages.loadedChannels.delete(channel);
    }
    for (const thread of messages.visibleThreads())
      void catchUpQueue.run(async () => messages.refreshThreadReplies(thread.ts));
  }

  return { handlers, onReconnect };
}
