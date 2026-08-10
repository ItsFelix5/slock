import type { Message } from "@slock/slack-api";
import { For, Show } from "solid-js";
import MessageRow from "./MessageRow";
import VirtualizedRows, { type VirtualRowsApi } from "./VirtualizedRows";

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
  // Only the main channel view opts into windowing (see MessageList.tsx) —
  // a single thread's reply count is small enough that virtualizing it isn't
  // worth the added complexity, so ThreadPanel.tsx just omits these and gets
  // the plain, unwindowed render exactly as before.
  virtualize?: boolean;
  scrollContainer?: () => HTMLElement | undefined;
  // Height of the header block (loading indicator / channel intro) rendered
  // above the virtualized rows in the same scroll container — fed to the
  // virtualizer so its offsets line up with the real scroll position.
  scrollMargin?: number;
  // "start" while MessageList.tsx is actively landing on a row that isn't
  // the newest message (an unread divider, a jump-to-date/message), so a
  // mid-flight prepend or resize doesn't fight that landing by re-anchoring
  // on the trailing edge instead. Reverts to "end" once settled.
  anchorTo?: "start" | "end";
  followOnAppend?: boolean | ScrollBehavior;
  // Called once with the virtualizer handle when windowing is active, so
  // MessageList.tsx can drive scroll-landing (unread divider, jump-to,
  // initial open) by index instead of querying the DOM for rows that may
  // currently be outside the rendered window.
  onApi?: (api: VirtualRowsApi) => void;
};

export default function MessageRows(props: MessageRowsProps) {
  return (
    <Show
      fallback={
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
      }
      when={props.virtualize && props.scrollContainer}
    >
      <VirtualizedRows {...props} />
    </Show>
  );
}
