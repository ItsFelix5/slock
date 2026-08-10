import type { Message } from "@slock/slack-api";
import { For } from "solid-js";
import MessageRow from "./MessageRow";

export type MessageRowsProps = {
  messages: Message[];
  channelId: string;
  threadTs?: string;
  onOpenThread?: (ts: string) => void;
  onReplyLink?: (msg: Message) => void;
  onJumpToMessage?: (ts: string) => void;
  // Roving-tabindex focus: the ts of the one row that should be keyboard
  // reachable right now (see messageFocus.ts).
  focusedTs?: () => string | null;
  // Real DOM focus within the list — separate from focusedTs, which also
  // holds a value before anyone has actually tabbed or clicked in.
  listFocused?: () => boolean;
  // Which message (if any) is in inline edit mode — lifted out of MessageRow
  // so the 'e' keyboard shortcut (messageFocus.ts) can trigger it remotely.
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
          listFocused={props.listFocused}
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
