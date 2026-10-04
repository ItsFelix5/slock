import { type Block, isMyRelayedMessage, type Message, type User } from "@slock/types";
import { broadcastReply, deleteMessage, editMessage } from "../../../api";
import { flashError, undoStack } from "../../../feedback";
import type { MessageLocation } from "../types";

export function createMessageMutations(deps: {
  currentUser: () => User | undefined;
  findAllMessageLocations: (
    channelId: string,
    ts: string,
  ) => { location: MessageLocation; list: Message[] }[];
  isChannelLoaded: (channelId: string) => boolean;
  patchMessage: (channelId: string, ts: string, patch: Partial<Message>) => void;
  insertMessageInOrder: (channelId: string, message: Message) => void;
}) {
  const findMessage = (channelId: string, ts: string) =>
    deps.findAllMessageLocations(channelId, ts)[0]?.list.find((m) => m.ts === ts);
  const isRelayed = (message: Message | undefined) =>
    !!message && isMyRelayedMessage(message, deps.currentUser());

  async function editMessageText(
    channelId: string,
    ts: string,
    text: string,
    blocks?: Block[],
    fileIds?: string[],
  ) {
    const trimmed = text.trim();
    if (!trimmed) return false;
    const previous = findMessage(channelId, ts);
    try {
      await editMessage(channelId, ts, trimmed, blocks, isRelayed(previous), fileIds);
      deps.patchMessage(channelId, ts, { blocks, edited: true, text: trimmed });
      if (previous && previous.text !== trimmed) {
        undoStack.push({
          label: "edit message",
          undo: () => void editMessageText(channelId, ts, previous.text, previous.blocks),
        });
      }
      return true;
    } catch (err) {
      console.error("Failed to edit message", err);
      flashError(ts, "Failed to edit message.");
      return false;
    }
  }

  async function broadcastThreadReply(channelId: string, ts: string) {
    const relayed = isRelayed(findMessage(channelId, ts));
    deps.patchMessage(channelId, ts, { isBroadcast: true });
    try {
      await broadcastReply(channelId, ts, relayed);
      const broadcasted = findMessage(channelId, ts);
      if (broadcasted && deps.isChannelLoaded(channelId))
        deps.insertMessageInOrder(channelId, broadcasted);
    } catch (err) {
      console.error("Failed to broadcast reply", err);
      flashError(ts, "Failed to send to channel.");
      deps.patchMessage(channelId, ts, { isBroadcast: false });
    }
  }

  async function deleteMessageAt(channelId: string, ts: string) {
    const relayed = isRelayed(findMessage(channelId, ts));
    try {
      await deleteMessage(channelId, ts, relayed);
      deps.patchMessage(channelId, ts, { deleted: true });
    } catch (err) {
      console.error("Failed to delete message", err);
      flashError(ts, "Failed to delete message.");
    }
  }

  return { broadcastThreadReply, deleteMessageAt, editMessageText };
}
