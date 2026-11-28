import { createQueue } from "@slock/core";
import { service } from "@slock/core/solid";
import { defineMutation } from "@slock/plugins/query/client/api";
import type { Block, ChannelId, FileId, Message, Ts, User } from "@slock/types";
import type { LocatedMessages } from "../lib/messageLocations";
import { isMyRelayedMessage } from "../lib/relayedMessages";
import { broadcastReply, deleteAttachment, deleteMessage, editMessage } from "../requests/send";

const feedback = service("feedback");

type Target = { channelId: ChannelId; ts: Ts };

export function createMessageMutations(deps: {
  currentUser: () => User | undefined;
  findAllMessageLocations: (channelId: ChannelId, ts: Ts) => LocatedMessages[];
  isChannelLoaded: (channelId: ChannelId) => boolean;
  markDeleted: (channelId: ChannelId, ts: Ts) => void;
  patchMessage: (channelId: ChannelId, ts: Ts, patch: Partial<Message>) => void;
  insertMessageInOrder: (channelId: ChannelId, message: Message) => void;
}) {
  const findMessage = (channelId: ChannelId, ts: Ts) =>
    deps.findAllMessageLocations(channelId, ts)[0]?.list.find((m) => m.ts === ts);
  const isRelayed = (message: Message | undefined) =>
    !!message && isMyRelayedMessage(message, deps.currentUser());

  async function performEdit(
    channelId: ChannelId,
    ts: Ts,
    text: string,
    blocks?: Block[],
    fileIds?: FileId[],
    removedAttachmentIds: number[] = [],
  ) {
    const trimmed = text.trim();
    if (!trimmed) return false;
    const previous = findMessage(channelId, ts);
    try {
      await editMessage(channelId, ts, trimmed, blocks, isRelayed(previous), fileIds);
      await Promise.all(removedAttachmentIds.map((id) => deleteAttachment(channelId, ts, id)));
      deps.patchMessage(channelId, ts, {
        ...(removedAttachmentIds.length && {
          attachments: previous?.attachments?.filter(
            (a) => a.id === undefined || !removedAttachmentIds.includes(a.id),
          ),
        }),
        blocks,
        edited: true,
        text: trimmed,
      });
      if (previous && previous.text !== trimmed) {
        feedback.undo.push({
          label: "edit message",
          undo: () => void editMessageText(channelId, ts, previous.text, previous.blocks),
        });
      }
      return true;
    } catch (err) {
      console.error("Failed to edit message", err);
      feedback.error(ts, "Failed to edit message.");
      return false;
    }
  }

  const edits = createQueue(1);
  const editMessageText = (...args: Parameters<typeof performEdit>) =>
    edits.run(() => performEdit(...args));

  const messageKey = ({ channelId, ts }: Target) => `${channelId}:${ts}`;

  const broadcast = defineMutation<Target, unknown>({
    key: messageKey,
    mode: "single",
    onError: (error, { channelId, ts }) => {
      console.error("Failed to broadcast reply", error);
      feedback.error(ts, "Failed to send to channel.");
      deps.patchMessage(channelId, ts, { isBroadcast: false });
    },
    onSuccess: (_result, { channelId, ts }) => {
      const broadcasted = findMessage(channelId, ts);
      if (broadcasted && deps.isChannelLoaded(channelId))
        deps.insertMessageInOrder(channelId, broadcasted);
    },
    optimistic: ({ channelId, ts }) => deps.patchMessage(channelId, ts, { isBroadcast: true }),
    run: ({ channelId, ts }) =>
      broadcastReply(channelId, ts, isRelayed(findMessage(channelId, ts))),
  });

  const removal = defineMutation<Target, unknown>({
    key: messageKey,
    mode: "single",
    onError: (error, { ts }) => {
      console.error("Failed to delete message", error);
      feedback.error(ts, "Failed to delete message.");
    },
    onSuccess: (_result, { channelId, ts }) => deps.markDeleted(channelId, ts),
    run: ({ channelId, ts }) => deleteMessage(channelId, ts, isRelayed(findMessage(channelId, ts))),
  });

  const broadcastThreadReply = (channelId: ChannelId, ts: Ts) => broadcast.run({ channelId, ts });
  const deleteMessageAt = (channelId: ChannelId, ts: Ts) => removal.run({ channelId, ts });

  return { broadcastThreadReply, deleteMessageAt, editMessageText };
}
