import { HighlightWordsContext } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import type { ChannelId, Message, Ts } from "@slock/types";
import { createMemo, For, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import MessageRow from "../../views/MessageRow";
import { retainsDeleted } from "../deletedMessages";
import type { OpenThreadHandler } from "../messageFocus";

const prefsStore = service("prefs");

export type MessageRowsProps = {
  messages: Message[];
  channelId: ChannelId;
  threadTs?: Ts;
  gap?: JSX.Element;
  gapAfterTs?: Ts;
  onOpenThread?: OpenThreadHandler;
  onReplyLink?: (msg: Message) => void;
  onJumpToMessage?: (ts: Ts) => void;

  focusedTs?: () => Ts | null;

  editingTs?: () => Ts | null;
  onStartEdit?: (ts: Ts) => void;
  onStopEdit?: () => void;

  reactionPickerTs?: () => Ts | null;
  onToggleReactionPicker?: (ts: Ts) => void;
  moreMenuTs?: () => Ts | null;
  onToggleMoreMenu?: (ts: Ts) => void;
};

export default function MessageRows(props: MessageRowsProps) {
  const messageByTs = createMemo(() => {
    const map = new Map<Ts, Message>();
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
    <HighlightWordsContext value={prefsStore.highlightWords}>
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
    </HighlightWordsContext>
  );
}
