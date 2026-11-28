import { service } from "@slock/core/solid";
import { defineMutation, defineQuery } from "@slock/plugins/query/client/api";
import { isReactionSettled, toggleReaction } from "@slock/plugins/slack/client/api";
import { hostedChannelId, hostedFileId, withReaction } from "@slock/slack";
import type { CanvasCommentThread, ChannelId, FileId, Ts, UserId } from "@slock/types";
import { createSignal } from "solid-js";
import { isThreadAnnotation } from "../../protocol/api";
import {
  fetchCanvasComments,
  openCanvasComment,
  resolveCanvasComment,
  syncCanvasComment,
} from "./canvasRequests";

const feedback = service("feedback");
const messageLinks = service("message-links");
const usersStore = service("users");

const canvasComments = defineQuery<FileId, CanvasCommentThread[]>({
  load: (fileId, { signal }) => fetchCanvasComments(fileId, signal),
  name: "canvasComments",
});

type ThreadTarget = Pick<CanvasCommentThread, "reactions" | "ts">;

interface ThreadWrite {
  fileId: FileId;
  ts: Ts;
}

function patchThread(
  threads: CanvasCommentThread[],
  ts: Ts,
  change: (thread: CanvasCommentThread) => Partial<CanvasCommentThread>,
) {
  return threads.map((thread) => (thread.ts === ts ? { ...thread, ...change(thread) } : thread));
}

const reaction = defineMutation<ThreadWrite & { name: string; reacted: boolean; userId: UserId }>({
  key: ({ fileId, name, ts }) => `${fileId}:${ts}:${name}`,
  mode: "single",
  onError: (error, { fileId }) => feedback.caught(fileId, error, "Couldn't update the reaction"),
  onSuccess: (_, { fileId }) => canvasComments.invalidate(fileId),
  optimistic: ({ fileId, name, reacted, ts, userId }, transaction) =>
    transaction.apply(canvasComments, fileId, (threads) =>
      patchThread(threads, ts, (thread) => ({
        reactions: withReaction(thread.reactions, name, userId, reacted),
      })),
    ),
  run: async ({ fileId, name, reacted, ts }) => {
    await toggleReaction(hostedChannelId(fileId), ts, name, !reacted);
  },
  settles: isReactionSettled,
});

const resolutionKey = ({ fileId, ts }: ThreadWrite) => `${fileId}:${ts}`;

const resolution = defineMutation<ThreadWrite & { resolved: boolean }>({
  key: resolutionKey,
  mode: "single",
  onError: (error, { resolved }) =>
    feedback.caught(
      "navigation",
      error,
      resolved ? "Couldn't resolve the comment" : "Couldn't reopen the comment",
    ),
  onSuccess: (_, { fileId }) => canvasComments.invalidate(fileId),
  optimistic: ({ fileId, resolved, ts }, transaction) =>
    transaction.apply(canvasComments, fileId, (threads) =>
      patchThread(threads, ts, () => ({ archived: resolved })),
    ),
  run: ({ fileId, resolved, ts }) => resolveCanvasComment(fileId, ts, resolved),
});

const creation = defineMutation<{
  annotationId: string;
  failure: string;
  fileId: FileId;
  use: (thread: ThreadTarget) => void;
}>({
  key: ({ annotationId, fileId }) => `${fileId}:${annotationId}`,
  mode: "single",
  onError: (error, { failure, fileId }) => feedback.caught(fileId, error, failure),
  run: async ({ annotationId, fileId, use }) => {
    const ts = await openCanvasComment(fileId, annotationId);
    use({ reactions: [], ts });
    canvasComments.invalidate(fileId);
  },
});

export const peekCommentThread = (fileId: FileId, ts: Ts) =>
  canvasComments.peek(fileId)?.find((thread) => thread.ts === ts);

export const setCommentResolved = (fileId: FileId, ts: Ts, resolved: boolean) =>
  void resolution.run({ fileId, resolved, ts });

export const commentResolving = (fileId: FileId, ts: Ts) =>
  resolution.pending(resolutionKey({ fileId, ts }));

// Slack only refreshes a thread's canvas state when the client asks after replying.
export function noteCommentActivity(channelId: ChannelId, myReplyTo?: Ts) {
  const fileId = hostedFileId(channelId);
  const threads = canvasComments.read(fileId);
  if (!threads) return;
  if (myReplyTo && threads.some((thread) => thread.ts === myReplyTo))
    syncCanvasComment(fileId, myReplyTo).catch((error: unknown) =>
      feedback.caught(myReplyTo, error, "Couldn't sync the comment"),
    );
  canvasComments.invalidate(fileId);
}

export type CanvasCommentsController = ReturnType<typeof createCanvasComments>;

export function createCanvasComments(fileId: () => FileId) {
  const query = canvasComments.state(fileId);
  const threads = () => query().data ?? [];
  const [created, setCreated] = createSignal<string[]>([]);

  const threadFor = (annotationId: string) =>
    threads().find((thread) => isThreadAnnotation(annotationId, thread.threadId));

  const started = () =>
    threads().filter((thread) => thread.replyCount > 0 || thread.reactions.length > 0);

  const markedIds = () => [
    ...started()
      .filter((thread) => !thread.archived)
      .map((thread) => thread.threadId),
    ...created().filter((id) => !threadFor(id)?.archived),
  ];

  const openThread = (thread: ThreadTarget, compose?: boolean) =>
    messageLinks.openThread(hostedChannelId(fileId()), thread.ts, undefined, { compose });

  function react(id: FileId, thread: ThreadTarget, name: string) {
    const userId = usersStore.currentUserId();
    if (!userId) return;
    const mine = thread.reactions.find((entry) => entry.name === name)?.users.includes(userId);
    void reaction.run({ fileId: id, name, reacted: !mine, ts: thread.ts, userId });
  }

  function withThread(annotationId: string, failure: string, use: (thread: ThreadTarget) => void) {
    const known = threadFor(annotationId);
    if (known) return use(known);
    setCreated((ids) => (ids.includes(annotationId) ? ids : [...ids, annotationId]));
    void creation.run({ annotationId, failure, fileId: fileId(), use });
  }

  return {
    markedIds,
    openAnnotation: (annotationId: string, compose?: boolean) =>
      withThread(annotationId, "Couldn't open the comment", (thread) =>
        openThread(thread, compose),
      ),
    openThread,
    reactToAnnotation(annotationId: string, name: string) {
      const id = fileId();
      withThread(annotationId, "Couldn't add the reaction", (thread) => react(id, thread, name));
    },
    reactToThread: (thread: ThreadTarget, name: string) => react(fileId(), thread, name),
    resolve: (thread: ThreadTarget, resolved: boolean) =>
      setCommentResolved(fileId(), thread.ts, resolved),
    resolving: (thread: ThreadTarget) => commentResolving(fileId(), thread.ts),
    started,
    status: () => query().status,
  };
}
