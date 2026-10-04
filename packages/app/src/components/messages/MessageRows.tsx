import type { Message } from "@slock/types";
import { createMemo, For } from "solid-js";
import MessageRow from "./MessageRow";
import type { OpenThreadHandler } from "./messageFocus";

export type MessageRowsProps = {
  messages: Message[];
  channelId: string;
  threadTs?: string;
  onOpenThread?: OpenThreadHandler;
  onReplyLink?: (msg: Message) => void;
  onJumpToMessage?: (ts: string) => void;

  focusedTs?: () => string | null;

  editingTs?: () => string | null;
  onStartEdit?: (ts: string) => void;
  onStopEdit?: () => void;

  reactionPickerTs?: () => string | null;
  onToggleReactionPicker?: (ts: string) => void;
  moreMenuTs?: () => string | null;
  onToggleMoreMenu?: (ts: string) => void;
};

export default function MessageRows(props: MessageRowsProps) {
  const messageByTs = createMemo(() => {
    const map = new Map<string, Message>();
    for (const m of props.messages) map.set(m.ts, m);
    return map;
  });

  return (
    <For each={props.messages}>
      {(message, index) => (
        <MessageRow
          channelId={props.channelId}
          editingTs={props.editingTs}
          focusedTs={props.focusedTs}
          index={index}
          message={message}
          messageByTs={messageByTs}
          messages={props.messages}
          moreMenuTs={props.moreMenuTs}
          onJumpToMessage={props.onJumpToMessage}
          onOpenThread={props.onOpenThread}
          onReplyLink={props.onReplyLink}
          onStartEdit={props.onStartEdit}
          onStopEdit={props.onStopEdit}
          onToggleMoreMenu={props.onToggleMoreMenu}
          onToggleReactionPicker={props.onToggleReactionPicker}
          reactionPickerTs={props.reactionPickerTs}
          threadTs={props.threadTs}
        />
      )}
    </For>
  );
}
