import { service } from "@slock/core/solid";
import type { CanvasCommentThread, ChannelId, FileId } from "@slock/types";
import { createQuery } from "@tanstack/solid-query";
import { defineKey } from "../../../query/client/api";
import { toggleReaction } from "../../../slack/client/api";
import { isThreadAnnotation } from "../api/canvasQuote";
import { type CanvasComments, fetchCanvasComments, openCanvasComment } from "./canvasRequests";

const feedback = service("feedback");
const query = service("query");
const commentsKey = defineKey<[string?]>("canvasComments");

const messageLinks = service("message-links");
const usersStore = service("users");

export function refreshCommentsForChannel(channelId: ChannelId) {
  for (const [queryKey, data] of query.client.getQueriesData<CanvasComments>({
    queryKey: commentsKey(),
  })) {
    if (data?.channelId === channelId) void query.client.invalidateQueries({ queryKey });
  }
}

export function createCanvasComments(fileId: () => FileId) {
  const commentsQuery = createQuery(
    () => ({ queryFn: () => fetchCanvasComments(fileId()), queryKey: commentsKey(fileId()) }),
    () => query.client,
  );
  const comments = () => commentsQuery.data;
  const refetch = () => commentsQuery.refetch();

  function hasMine(thread: CanvasCommentThread | undefined, name: string) {
    const me = usersStore.currentUser()?.id;
    return (
      !!me && !!thread?.reactions.find((reaction) => reaction.name === name)?.users.includes(me)
    );
  }

  async function run(action: () => Promise<void>, failure: string) {
    try {
      await action();
      await refetch();
    } catch (error) {
      feedback.caught(fileId(), error, failure);
    }
  }

  const reactToThread = (thread: CanvasCommentThread, name: string) =>
    run(async () => {
      const channelId = comments()?.channelId;
      if (channelId) await toggleReaction(channelId, thread.ts, name, hasMine(thread, name));
    }, "Couldn't update the reaction");

  const openThread = (thread: CanvasCommentThread) => {
    const channelId = comments()?.channelId;
    if (channelId) messageLinks.openThread(channelId, thread.ts, undefined, { pinned: true });
  };

  const openAnnotation = (annotationId: string) =>
    run(async () => {
      const { channelId, ts } = await openCanvasComment(fileId(), annotationId);
      messageLinks.openThread(channelId, ts, undefined, { pinned: true });
    }, "Couldn't open the comment");

  const reactToAnnotation = (annotationId: string, name: string) =>
    run(async () => {
      const { channelId, ts } = await openCanvasComment(fileId(), annotationId);
      const thread = comments()?.threads.find((t) => isThreadAnnotation(annotationId, t.threadId));
      await toggleReaction(channelId, ts, name, hasMine(thread, name));
    }, "Couldn't add the reaction");

  return { comments, openAnnotation, openThread, reactToAnnotation, reactToThread };
}
