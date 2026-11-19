import { HighlightWordsContext } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import type { Message } from "@slock/types";
import { createMemo, For, type JSX, Show } from "solid-js";
import MessageRow from "../../views/MessageRow";
import { retainsDeleted } from "../deletedMessages";
import type { OpenThreadHandler } from "../messageFocus";

const prefsStore = service("prefs");

export type MessageRowsProps = {
  messages: Message[];
  channelId: string;
  threadTs?: string;
  gap?: JSX.Element;
  gapAfterTs?: string;
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

  const previousVisible = createMemo(() => {
    const result: (Message | undefined)[] = [];
    let last: Message | undefined;
    for (const message of props.messages) {
      result.push(last);
      if (!message.deleted || retainsDeleted(message)) last = message;
    }
    return result;
  });

  return (
    <HighlightWordsContext.Provider value={prefsStore.highlightWords}>
      <For each={props.messages}>
        {(message, index) => {
          const prev = createMemo(() => previousVisible()[index()]);
          return (
            <>
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
                prev={prev}
                reactionPickerTs={props.reactionPickerTs}
                threadTs={props.threadTs}
              />
              <Show when={message.ts === props.gapAfterTs}>{props.gap}</Show>
            </>
          );
        }}
      </For>
    </HighlightWordsContext.Provider>
  );
}
