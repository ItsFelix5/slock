import { isDmId } from "@slock/plugins/dms/client/api";
import { ifPresent, isHiddenSubtype, parseChannelId, parseTs } from "@slock/slack";
import { mapMessage } from "@slock/slack/client";
import type {
  Channel,
  ChannelId,
  DirectMessage,
  GatewayMessageEvent,
  Message,
  Ts,
  User,
  UserId,
} from "@slock/types";
import { isPendingMessage } from "../api/messageMerge";
import type { LocatedMessages } from "../lib/messageLocations";
import { createChannelActivityBatcher } from "./channelActivity";

type IncomingMessageDeps = {
  closedDmIds: Record<ChannelId, boolean>;
  currentUser: () => User | undefined;
  dmById: (id: ChannelId) => DirectMessage | undefined;
  ensureDm: (channelId: ChannelId, userId: UserId) => void;
  findAllMessageLocations: (channelId: ChannelId, ts: Ts) => LocatedMessages[];
  insertMessageInOrder: (channelId: ChannelId, msg: Message) => void;
  isChannelMember: (id: ChannelId) => boolean;
  acceptsLiveReplies: (ts: Ts) => boolean;
  tracksLatest: (channelId: ChannelId) => boolean;
  markDeleted: (channelId: ChannelId, ts: Ts) => void;
  mergeIncomingMessage: (existing: Message[], msg: Message) => Message[];
  patchChannel: (id: ChannelId, patch: Partial<Channel>) => void;
  patchMessage: (channelId: ChannelId, ts: Ts, patch: Partial<Message>) => void;
  setClosedDmIds: (id: ChannelId, closed: boolean) => void;
  updateChannelMessages: (channelId: ChannelId, update: (existing: Message[]) => Message[]) => void;
  updateThreadMessages: (threadTs: Ts, update: (existing: Message[]) => Message[]) => void;
  setThreadReadTs: (threadTs: Ts, ts: Ts) => void;
  setUnreadChannelIds: (id: ChannelId, unread: boolean) => void;
  threadMessages: Record<Ts, Message[]>;
  isViewed: (channelId: ChannelId) => boolean;
};

export function createIncomingMessageHandler(deps: IncomingMessageDeps) {
  const mergeIntoChannel = (channel: ChannelId, msg: Message) =>
    deps.updateChannelMessages(channel, (existing) => deps.mergeIncomingMessage(existing, msg));
  const mergeIntoThread = (threadTs: Ts, msg: Message) =>
    deps.updateThreadMessages(threadTs, (existing) => deps.mergeIncomingMessage(existing, msg));
  const markActivity = createChannelActivityBatcher(deps.patchChannel);
  const latestReplyByThread = new Map<Ts, Ts>();
  const seenReplyKeys = new Set<string>();

  function hasSeenReply(channel: ChannelId, ts: Ts) {
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
    const { subtype } = payload;
    const channel = ifPresent(parseChannelId, payload.channel);
    const threadTs = ifPresent(parseTs, payload.thread_ts);
    const ts = ifPresent(parseTs, payload.ts);
    if (!channel) return;
    if (subtype === "message_changed") {
      const updated = payload.message;
      const updatedTs = ifPresent(parseTs, updated?.ts);
      if (!(updated && updatedTs)) return;
      if (isHiddenSubtype(updated.subtype)) {
        deps.markDeleted(channel, updatedTs);
        return;
      }
      const isBroadcast = updated.subtype === "thread_broadcast";
      const mapped = mapMessage(updated);
      deps.patchMessage(channel, updatedTs, {
        blocks: updated.blocks,
        edited: !!updated.edited,
        editedTs: mapped.editedTs,
        isBroadcast,
        text: mapped.text,
        attachments: mapped.attachments,
        files: mapped.files,
      });
      if (isBroadcast && deps.tracksLatest(channel)) {
        const msg = deps
          .findAllMessageLocations(channel, updatedTs)[0]
          ?.list.find((m) => m.ts === updatedTs);
        if (msg) deps.insertMessageInOrder(channel, msg);
      }
      return;
    }
    if (subtype === "message_replied") {
      const updated = payload.message;
      const updatedTs = ifPresent(parseTs, updated?.ts);
      if (!(updated && updatedTs)) return;
      const { lastReplyLabel, latestReply, replyCount, replyUsers, replyUsersCount } =
        mapMessage(updated);
      const latestReplyTs = ifPresent(parseTs, updated.latest_reply);
      if (latestReplyTs) latestReplyByThread.set(updatedTs, latestReplyTs);
      deps.patchMessage(channel, updatedTs, {
        lastReplyLabel,
        latestReply,
        replyCount,
        replyUsers,
        replyUsersCount,
      });
      return;
    }
    if (subtype === "message_locked") {
      if (threadTs) deps.patchMessage(channel, threadTs, { isLocked: payload.is_locked });
      return;
    }
    if (subtype === "message_deleted") {
      const deletedTs = ifPresent(parseTs, payload.deleted_ts);
      if (deletedTs) deps.markDeleted(channel, deletedTs);
      return;
    }
    if (!ts) return;
    const msg = mapMessage({ ...payload, ts });
    if (msg.isEphemeral) {
      if (threadTs && threadTs !== ts) {
        if (deps.acceptsLiveReplies(threadTs)) mergeIntoThread(threadTs, msg);
      } else if (deps.tracksLatest(channel)) {
        mergeIntoChannel(channel, msg);
      }
      return;
    }
    const me = deps.currentUser();
    const isThreadReply = !!threadTs && threadTs !== ts;
    if (threadTs && isThreadReply) {
      const existingReplies = deps.threadMessages[threadTs] ?? [];
      const alreadyMerged =
        hasSeenReply(channel, msg.ts) ||
        existingReplies.some(
          (reply) => (reply.ts === msg.ts || reply.id === msg.id) && !isPendingMessage(reply),
        );
      if (deps.acceptsLiveReplies(threadTs)) mergeIntoThread(threadTs, msg);
      if (msg.userId === me?.id) deps.setThreadReadTs(threadTs, msg.ts);
      const parentLocations = deps.findAllMessageLocations(channel, threadTs);
      const parentMsg = parentLocations[0]?.list.find((m) => m.ts === threadTs);
      const latestReplyTs = latestReplyByThread.get(threadTs);
      const countAlreadyConfirmed =
        latestReplyTs && parseFloat(latestReplyTs) >= parseFloat(msg.ts);
      if (parentMsg && !alreadyMerged && !countAlreadyConfirmed) {
        deps.patchMessage(channel, threadTs, { replyCount: (parentMsg.replyCount ?? 0) + 1 });
      }
      if (subtype === "thread_broadcast" && deps.tracksLatest(channel)) {
        mergeIntoChannel(channel, msg);
      }
    } else if (deps.tracksLatest(channel)) {
      mergeIntoChannel(channel, msg);
    }

    if (
      me &&
      msg.userId !== me.id &&
      msg.kind !== "system" &&
      !isThreadReply &&
      !deps.isViewed(channel)
    ) {
      deps.setUnreadChannelIds(channel, true);
    }
    if (deps.dmById(channel)) {
      if (deps.closedDmIds[channel]) deps.setClosedDmIds(channel, false);
    } else if (isDmId(channel, () => false) && me && msg.userId && msg.userId !== me.id) {
      deps.ensureDm(channel, msg.userId);
    } else if (deps.isChannelMember(channel)) {
      markActivity(channel);
    }
  }
  return handleIncomingMessage;
}
