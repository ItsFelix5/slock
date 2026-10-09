import { type GatewayMessageEvent, type Message, mapMessage } from "@slock/types";
import { isPendingMessage } from "../../../messageMerge";
import { isDmId } from "../entities/dms";
import type { RealtimeDeps } from "./realtimeDeps";

export function createIncomingMessageHandler(deps: RealtimeDeps) {
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
      const { lastReplyLabel, replyCount, replyUsers } = mapMessage(updated);
      if (updated.latest_reply) latestReplyByThread.set(updated.ts, updated.latest_reply);
      deps.patchMessage(channel, updated.ts, {
        lastReplyLabel,
        replyCount,
        replyUsers,
      });
      return;
    }
    if (subtype === "message_deleted") {
      const ts = payload.deleted_ts;
      if (!ts) return;
      const existing = deps.findAllMessageLocations(channel, ts);
      if (existing[0]?.list.find((m) => m.ts === ts)?.metadata?.event_type === "anchor")
        for (const { location } of existing) deps.removeMessage(location, ts);
      else deps.patchMessage(channel, ts, { deleted: true });
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
    deps.clearTyping(channel, isThreadReply ? threadTs : undefined, msg.userId);
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
        deps.patchMessage(channel, threadTs, {
          replyCount: (parentMsg.replyCount ?? 0) + 1,
        });
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
