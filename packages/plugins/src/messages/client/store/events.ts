import { createQueue } from "@slock/core";
import type { Services } from "@slock/core/types";
import { gatewayHandler } from "@slock/plugins/realtime/client/api";
import { invalidateMessageLookup, primeMessageLookup } from "@slock/plugins/slack/client/api";
import { ifPresent, parseChannelId, parseTs, parseUserId } from "@slock/slack";
import { createIncomingMessageHandler } from "./incomingMessages";
import type { createMessagesStore } from "./index";

const CATCH_UP_CONCURRENCY = 4;

type Messages = ReturnType<typeof createMessagesStore>;

export function createMessageEvents(
  messages: Messages,
  deps: {
    channels: Pick<Services["channels"], "isChannelMember" | "patchChannel">;
    dms: Pick<Services["dms"], "closedDmIds" | "dmById" | "ensureDm" | "setClosedDmIds">;
    conversations: Pick<Services["conversations"], "mountedViews">;
    unread: Pick<Services["unread"], "isViewed" | "setThreadReadTs" | "setUnreadChannelIds">;
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
    updateChannelMessages: messages.updateChannelMessages,
    updateThreadMessages: messages.updateThreadMessages,
    setThreadReadTs: unread.setThreadReadTs,
    setUnreadChannelIds: unread.setUnreadChannelIds,
    threadMessages: messages.threadMessages,
    isViewed: unread.isViewed,
  });

  const handlers = [
    gatewayHandler(["message"], (event) => {
      primeMessageLookup(event);
      handleIncomingMessage(event);
    }),
    gatewayHandler(["reaction_added", "reaction_removed"], (event) => {
      const channel = ifPresent(parseChannelId, event.item.channel);
      const ts = ifPresent(parseTs, event.item.ts);
      const user = ifPresent(parseUserId, event.user);
      if (!(channel && ts && event.reaction && user)) return;
      invalidateMessageLookup(channel, ts);
      messages.realtimeHooks.applyReactionEvent(
        channel,
        ts,
        event.reaction,
        user,
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
        const channel = ifPresent(parseChannelId, event.channel);
        if (channel && messages.loadedChannels.has(channel)) messages.loadRecentHistory(channel);
      },
    ),
    gatewayHandler(["thread_subscribed", "thread_unsubscribed"], (event) => {
      const channel = ifPresent(parseChannelId, event.channel);
      const threadTs = ifPresent(parseTs, event.thread_ts);
      if (channel && threadTs)
        messages.patchMessage(channel, threadTs, {
          isSubscribed: event.type === "thread_subscribed",
        });
    }),
  ];

  const catchUpQueue = createQueue(CATCH_UP_CONCURRENCY);

  function onReconnect() {
    const visibleIds = new Set(conversations.mountedViews().map((view) => view.id));
    for (const channel of messages.loadedChannels) {
      if (visibleIds.has(channel))
        void catchUpQueue.run(async () => messages.loadRecentHistory(channel));
      else messages.loadedChannels.delete(channel);
    }
    messages.resyncThreads();
  }

  return { handlers, onReconnect };
}
