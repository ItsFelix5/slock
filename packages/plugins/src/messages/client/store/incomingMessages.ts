import { isHiddenSubtype, mapMessage } from "@slock/slack";
import type { Channel, DirectMessage, GatewayMessageEvent, Message, User } from "@slock/types";
import type { View } from "../../../conversations/client/api/types";
import { isDmId } from "../../../dms/client/api";
import { isPendingMessage } from "../api/messageMerge";
import type { MessageLocation } from "../lib/messageLocations";

type IncomingMessageDeps = {
  closedDmIds: Record<string, boolean>;
  currentUser: () => User | undefined;
  dmById: (id: string) => DirectMessage | undefined;
  ensureDm: (channelId: string, userId: string) => void;
  findAllMessageLocations: (
    channelId: string,
    ts: string,
  ) => { location: MessageLocation; list: Message[] }[];
  insertMessageInOrder: (channelId: string, msg: Message) => void;
  isChannelMember: (id: string) => boolean;
  isThreadKnown: (ts: string) => boolean;
  loadedChannels: Set<string>;
  markDeleted: (channelId: string, ts: string) => void;
  mergeIncomingMessage: (existing: Message[], msg: Message) => Message[];
  patchChannel: (id: string, patch: Partial<Channel>) => void;
  patchMessage: (channelId: string, ts: string, patch: Partial<Message>) => void;
  setClosedDmIds: (id: string, closed: boolean) => void;
  setMessagesByChannel: (channelId: string, updater: (existing?: Message[]) => Message[]) => void;
  setThreadMessages: (threadTs: string, updater: (existing?: Message[]) => Message[]) => void;
  setUnreadChannelIds: (id: string, unread: boolean) => void;
  threadMessages: Record<string, Message[]>;
  visibleViews: () => View[];
};

export function createIncomingMessageHandler(deps: IncomingMessageDeps) {
  const mergeIntoChannel = (channel: string, msg: Message) =>
    deps.setMessagesByChannel(channel, (existing: Message[] = []) =>
      deps.mergeIncomingMessage(existing, msg),
    );
  const latestReplyByThread = new Map<string, string>();
  const seenReplyKeys = new Set<string>();

  function hasSeenReply(channel: string, ts: string) {
    const key = `${channel}:${ts}`;
    if (seenReplyKeys.has(key)) return true;
    seenReplyKeys.add(key);
    if (seenReplyKeys.size > 5000) {
      const oldest = seenReplyKeys.values().next().value;
      if (oldest) seenReplyKeys.delete(oldest);
    }
    return false;
  }

  function handleIncomingMessage(payload: GatewayMessageEvent) {
    const { channel, subtype, ts, thread_ts: threadTs } = payload;
    if (!channel) return;
    if (subtype === "message_changed") {
      const updated = payload.message;
      if (!updated?.ts) return;
      if (isHiddenSubtype(updated.subtype)) {
        deps.markDeleted(channel, updated.ts);
        return;
      }
      const isBroadcast = updated.subtype === "thread_broadcast";
      const mapped = mapMessage(updated);
      deps.patchMessage(channel, updated.ts, {
        blocks: updated.blocks,
        edited: !!updated.edited,
        isBroadcast,
        text: updated.text,
        attachments: mapped.attachments,
        files: mapped.files,
      });
      if (isBroadcast && deps.loadedChannels.has(channel)) {
        const msg = deps
          .findAllMessageLocations(channel, updated.ts)[0]
          ?.list.find((m) => m.ts === updated.ts);
        if (msg) deps.insertMessageInOrder(channel, msg);
      }
      return;
    }
    if (subtype === "message_replied") {
      const updated = payload.message;
      if (!updated?.ts) return;
      const { lastReplyLabel, latestReply, replyCount, replyUsers } = mapMessage(updated);
      if (updated.latest_reply) latestReplyByThread.set(updated.ts, updated.latest_reply);
      deps.patchMessage(channel, updated.ts, {
        lastReplyLabel,
        latestReply,
        replyCount,
        replyUsers,
      });
      return;
    }
    if (subtype === "message_deleted") {
      const ts = payload.deleted_ts;
      if (!ts) return;
      deps.markDeleted(channel, ts);
      return;
    }
    if (!ts) return;
    const msg = mapMessage({ ...payload, ts });
    if (msg.isEphemeral) {
      if (deps.loadedChannels.has(channel)) {
        mergeIntoChannel(channel, msg);
      }
      return;
    }
    const me = deps.currentUser();
    const isThreadReply = !!threadTs && threadTs !== ts;
    if (isThreadReply) {
      const existingReplies = deps.threadMessages[threadTs] ?? [];
      const alreadyMerged =
        hasSeenReply(channel, msg.ts) ||
        existingReplies.some(
          (reply) => (reply.ts === msg.ts || reply.id === msg.id) && !isPendingMessage(reply),
        );
      if (deps.isThreadKnown(threadTs)) {
        deps.setThreadMessages(threadTs, (existing: Message[] = []) =>
          deps.mergeIncomingMessage(existing, msg),
        );
      }
      const parentLocations = deps.findAllMessageLocations(channel, threadTs);
      const parentMsg = parentLocations[0]?.list.find((m) => m.ts === threadTs);
      const latestReplyTs = latestReplyByThread.get(threadTs);
      const countAlreadyConfirmed =
        latestReplyTs && parseFloat(latestReplyTs) >= parseFloat(msg.ts);
      if (parentMsg && !alreadyMerged && !countAlreadyConfirmed) {
        deps.patchMessage(channel, threadTs, { replyCount: (parentMsg.replyCount ?? 0) + 1 });
      }
      if (subtype === "thread_broadcast" && deps.loadedChannels.has(channel)) {
        mergeIntoChannel(channel, msg);
      }
    } else if (deps.loadedChannels.has(channel)) {
      mergeIntoChannel(channel, msg);
    }

    if (
      me &&
      msg.userId !== me.id &&
      !isThreadReply &&
      !deps.visibleViews().some((v) => v.id === channel)
    ) {
      deps.setUnreadChannelIds(channel, true);
    }
    if (deps.dmById(channel)) {
      if (deps.closedDmIds[channel]) deps.setClosedDmIds(channel, false);
    } else if (isDmId(channel, () => false) && me && msg.userId !== me.id) {
      deps.ensureDm(channel, msg.userId);
    } else if (deps.isChannelMember(channel)) {
      deps.patchChannel(channel, { lastActivity: Date.now() });
    }
  }
  return handleIncomingMessage;
}
