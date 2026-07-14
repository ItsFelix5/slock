import type { Message } from "@slock/slack-api";
import { For } from "solid-js";
import MessageRow from "./MessageRow";

export default function MessageRows(props: {
  messages: Message[];
  channelId: string;
  threadTs?: string;
  onOpenThread?: (ts: string) => void;
  onReplyLink?: (msg: Message) => void;
  onJumpToMessage?: (ts: string) => void;
}) {
  return (
    <For each={props.messages}>
      {(_, index) => (
        <MessageRow
          channelId={props.channelId}
          index={index}
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
