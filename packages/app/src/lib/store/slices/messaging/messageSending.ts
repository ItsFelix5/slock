import {
  type Block,
  broadcastRangeFromBlocks,
  formatTimeFromMs,
  type Message,
  type PendingFile,
  type User,
} from "@slock/types";
import { produce, type SetStoreFunction } from "solid-js/store";
import { postBroadcastMessage, postMessage, uploadFiles } from "../../../api";
import { dedupeMessages } from "../../../messageMerge";
import type { MessageLocation } from "../types";

type MessageStoreSetter = SetStoreFunction<Record<string, Message[]>>;

function optimisticMessage(me: User | undefined, fields: Partial<Message>): Message {
  const now = Date.now();
  return {
    day: "Today",
    id: `pending-${now}`,
    kind: "normal",
    pending: true,
    text: "",
    time: formatTimeFromMs(now),
    ts: String(now / 1000),
    userId: me?.id ?? "",
    ...fields,
  };
}

export function createMessageSending(deps: {
  currentUser: () => User | undefined;
  setChannelMessages: MessageStoreSetter;
  setThreadMessages: MessageStoreSetter;
  patchMessage: (channelId: string, ts: string, patch: Partial<Message>) => void;
  removeMessage: (location: MessageLocation, ts: string) => void;
}) {
  const setterFor = (location: MessageLocation) =>
    location.store === "thread" ? deps.setThreadMessages : deps.setChannelMessages;

  function appendOptimistic(channelId: string, threadTs: string | undefined, message: Message) {
    const location: MessageLocation = threadTs
      ? { key: threadTs, store: "thread" }
      : { key: channelId, store: "channel" };
    setterFor(location)(
      produce((draft) => {
        draft[location.key] ??= [];
        draft[location.key].push(message);
      }),
    );
    return location;
  }

  async function sendMessage(
    channelId: string,
    text: string,
    threadTs?: string,
    blocks?: Block[],
    suppressUnfurl?: boolean,
    fileIds?: string[],
  ) {
    const trimmed = text.trim();
    if (!(trimmed || blocks)) return;
    const optimistic = optimisticMessage(deps.currentUser(), { blocks, text: trimmed });
    const location = appendOptimistic(channelId, threadTs, optimistic);
    try {
      const res = broadcastRangeFromBlocks(blocks)
        ? await postBroadcastMessage(channelId, trimmed, threadTs, blocks, suppressUnfurl)
        : await postMessage(channelId, trimmed, threadTs, blocks, suppressUnfurl, fileIds);
      setterFor(location)(location.key, (list) =>
        dedupeMessages(
          list.map((m) => (m.id === optimistic.id ? { ...m, pending: false, ts: res.ts } : m)),
        ),
      );
    } catch (err) {
      console.error("Failed to send message", err);
      deps.removeMessage(location, optimistic.ts);
      throw err;
    }
  }

  async function sendFiles(channelId: string, files: File[], threadTs?: string, comment?: string) {
    if (files.length === 0) return;
    const pendingFiles: PendingFile[] = files.map((file, i) => ({
      id: `pending-file-${Date.now()}-${i}`,
      isImage: file.type.startsWith("image/"),
      name: file.name,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      progress: 0,
      size: file.size,
    }));
    const optimistic = optimisticMessage(deps.currentUser(), {
      pendingFiles,
      text: comment?.trim() ?? "",
    });
    const location = appendOptimistic(channelId, threadTs, optimistic);
    const revokePreviews = () => {
      for (const pf of pendingFiles) if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
    };
    try {
      let currentFiles = pendingFiles;
      await uploadFiles(
        channelId,
        files.map((file) => ({ file })),
        threadTs,
        comment,
        (fileIndex, fraction) => {
          currentFiles = currentFiles.map((pf, i) =>
            i === fileIndex ? { ...pf, progress: fraction } : pf,
          );
          deps.patchMessage(channelId, optimistic.ts, { pendingFiles: currentFiles });
        },
      );
      deps.patchMessage(channelId, optimistic.ts, { pending: false });
      revokePreviews();
    } catch (err) {
      console.error("Failed to upload files", err);
      revokePreviews();
      deps.removeMessage(location, optimistic.ts);
      throw err;
    }
  }

  return { sendFiles, sendMessage };
}
