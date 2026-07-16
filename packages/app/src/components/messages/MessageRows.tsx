import type { Message } from "@slock/slack-api";
import { createEffect, For } from "solid-js";
import { store } from "../../lib/store";
import MessageRow from "./MessageRow";

function debugUnreadDivider(channelId: string, messages: Message[]) {
  if (!import.meta.env.DEV) return;
  const anchor = store.unread.unreadDividerTsForChannel(channelId);
  const [first] = messages;
  const latest = messages[messages.length - 1];
  const boundaryIndex =
    anchor == null || !Number.isFinite(anchor)
      ? -1
      : messages.findIndex((msg, index) => {
          const prev = messages[index - 1];
          return (
            parseFloat(msg.ts) * 1000 > anchor && (!prev || parseFloat(prev.ts) * 1000 <= anchor)
          );
        });
  const reason =
    anchor == null
      ? "no-anchor"
      : Number.isFinite(anchor)
        ? boundaryIndex === -1
          ? "anchor-outside-loaded-range"
          : "boundary-found"
        : "sentinel-no-unread-gap";

  console.debug("[slock unread divider]", {
    anchor,
    boundaryIndex,
    boundaryTs: messages[boundaryIndex]?.ts,
    channelId,
    firstTs: first?.ts,
    latestTs: latest?.ts,
    messageCount: messages.length,
    reason,
  });
}

export default function MessageRows(props: {
  messages: Message[];
  channelId: string;
  threadTs?: string;
  onOpenThread?: (ts: string) => void;
  onReplyLink?: (msg: Message) => void;
  onJumpToMessage?: (ts: string) => void;
}) {
  createEffect(() => {
    if (!props.threadTs) debugUnreadDivider(props.channelId, props.messages);
  });

  return (
    <For each={props.messages}>
      {(message, index) => (
        <MessageRow
          channelId={props.channelId}
          index={index}
          message={message}
          messages={props.messages}
          onJumpToMessage={props.onJumpToMessage}
          onOpenThread={props.onOpenThread}
          onReplyLink={props.onReplyLink}
          threadTs={props.threadTs}
        />
      )}
    </For>
  );
}
