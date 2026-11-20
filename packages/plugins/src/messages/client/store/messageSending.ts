import { formatTimeFromMs } from "@slock/core";
import { service } from "@slock/core/solid";
import { broadcastRangeOf, parseTs } from "@slock/slack";
import type { Block, ChannelId, FileId, Message, PendingFile, Ts, User } from "@slock/types";
import { reconcile } from "solid-js";
import { postBroadcastMessage, postMessage, uploadFiles } from "../../../slack/client/api";
import { dedupeMessages } from "../api/messageMerge";
import type { MessageLocation } from "../lib/messageLocations";
import { tsFromMs } from "../lib/tsTime";

const env = service("env");

function optimisticMessage(me: User | undefined, now: number, fields: Partial<Message>): Message {
  return {
    day: "Today",
    id: `pending-${now}`,
    kind: "normal",
    pending: true,
    text: "",
    time: formatTimeFromMs(now),
    ts: tsFromMs(now),
    userId: me?.id,
    ...fields,
  };
}

export function createMessageSending(deps: {
  currentUser: () => User | undefined;
  editList: (location: MessageLocation, edit: (list: Message[]) => void) => void;
  patchMessage: (channelId: ChannelId, ts: Ts, patch: Partial<Message>) => void;
  removeMessage: (location: MessageLocation, ts: Ts) => void;
}) {
  let lastOptimisticMs = 0;
  const nextOptimisticMs = () => {
    lastOptimisticMs = Math.max(env.now(), lastOptimisticMs + 1);
    return lastOptimisticMs;
  };

  function appendOptimistic(channelId: ChannelId, threadTs: Ts | undefined, message: Message) {
    const location: MessageLocation = threadTs
      ? { key: threadTs, store: "thread" }
      : { key: channelId, store: "channel" };
    deps.editList(location, (list) => {
      list.push(message);
    });
    return location;
  }

  async function sendMessage(
    channelId: ChannelId,
    text: string,
    unfurl: string[],
    threadTs?: Ts,
    blocks?: Block[],
    fileIds?: FileId[],
  ) {
    const trimmed = text.trim();
    if (!(trimmed || blocks)) return;
    const optimistic = optimisticMessage(deps.currentUser(), nextOptimisticMs(), {
      blocks,
      text: trimmed,
      threadTs,
    });
    const location = appendOptimistic(channelId, threadTs, optimistic);
    try {
      const res = broadcastRangeOf({ blocks, text: trimmed })
        ? await postBroadcastMessage(channelId, trimmed, unfurl, threadTs, blocks)
        : await postMessage(channelId, trimmed, unfurl, threadTs, blocks, fileIds);
      const confirmedTs = parseTs(res.ts);
      deps.editList(location, (list) => {
        const confirmed = dedupeMessages(
          list.map((m) => (m.id === optimistic.id ? { ...m, pending: false, ts: confirmedTs } : m)),
        );
        reconcile(confirmed, "id")(list);
      });
    } catch (err) {
      console.error("Failed to send message", err);
      deps.removeMessage(location, optimistic.ts);
      throw err;
    }
  }

  async function sendFiles(channelId: ChannelId, files: File[], threadTs?: Ts, comment?: string) {
    if (files.length === 0) return;
    const pendingFiles: PendingFile[] = files.map((file, i) => ({
      id: `pending-file-${env.now()}-${i}`,
      isImage: file.type.startsWith("image/"),
      name: file.name,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      progress: 0,
      size: file.size,
    }));
    const optimistic = optimisticMessage(deps.currentUser(), nextOptimisticMs(), {
      pendingFiles,
      text: comment?.trim() ?? "",
      threadTs,
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
