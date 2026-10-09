import type { CanvasCommentThread } from "@slock/types";
import { createResource } from "solid-js";
import { fetchCanvasComments, openCanvasComment, toggleReaction } from "../api";
import { flashCaughtError } from "../feedback";
import { store } from "../store";
import { isThreadAnnotation } from "./canvasQuote";

export function createCanvasComments(fileId: () => string) {
  const [comments, { refetch }] = createResource(fileId, fetchCanvasComments);

  function hasMine(thread: CanvasCommentThread | undefined, name: string) {
    const me = store.users.currentUser()?.id ?? "";
    return !!thread?.reactions.find((reaction) => reaction.name === name)?.users.includes(me);
  }

  async function run(action: () => Promise<void>, failure: string) {
    try {
      await action();
      await refetch();
    } catch (error) {
      flashCaughtError(fileId(), error, failure);
    }
  }

  const reactToThread = (thread: CanvasCommentThread, name: string) =>
    run(async () => {
      await toggleReaction(comments()?.channelId ?? "", thread.ts, name, hasMine(thread, name));
    }, "Couldn't update the reaction");

  const openThread = (thread: CanvasCommentThread) =>
    store.viewState.openThread(comments()?.channelId ?? "", thread.ts, undefined, {
      pinned: true,
    });

  const openAnnotation = (annotationId: string) =>
    run(async () => {
      const { channelId, ts } = await openCanvasComment(fileId(), annotationId);
      store.viewState.openThread(channelId, ts, undefined, { pinned: true });
    }, "Couldn't open the comment");

  const reactToAnnotation = (annotationId: string, name: string) =>
    run(async () => {
      const { channelId, ts } = await openCanvasComment(fileId(), annotationId);
      const thread = comments()?.threads.find((t) => isThreadAnnotation(annotationId, t.threadId));
      await toggleReaction(channelId, ts, name, hasMine(thread, name));
    }, "Couldn't add the reaction");

  return { comments, openAnnotation, openThread, reactToAnnotation, reactToThread };
}
