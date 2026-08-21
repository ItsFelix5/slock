import { For } from "solid-js";
import type { Message } from "../../lib/api";
import MessageRow from "./MessageRow";

export type MessageRowsProps = {
  messages: Message[];
  channelId: string;
  threadTs?: string;
  onOpenThread?: (ts: string, opts?: { pinned?: boolean }) => void;
  onReplyLink?: (msg: Message) => void;
  onJumpToMessage?: (ts: string) => void;

  focusedTs?: () => string | null;

  editingTs?: () => string | null;
  onStartEdit?: (ts: string) => void;
  onStopEdit?: () => void;
};

export default function MessageRows(props: MessageRowsProps) {
  return (
    <For each={props.messages}>
      {(message, index) => (
        <MessageRow
          channelId={props.channelId}
          editingTs={props.editingTs}
          focusedTs={props.focusedTs}
          index={index}
          message={message}
          messages={props.messages}
          onJumpToMessage={props.onJumpToMessage}
          onOpenThread={props.onOpenThread}
          onReplyLink={props.onReplyLink}
          onStartEdit={props.onStartEdit}
          onStopEdit={props.onStopEdit}
          threadTs={props.threadTs}
        />
      )}
    </For>
  );
}
