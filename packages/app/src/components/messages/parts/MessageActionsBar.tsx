import type { Message } from "@slock/slack-api";
import { Icon, Menu, Tooltip } from "@slock/ui";
import { createMemo, createSignal, lazy, Show } from "solid-js";
import { store } from "../../../lib/store";
import MessageActionsMenuItems from "./MessageActionsMenuItems";

// This toolbar renders unconditionally on every message row, so an eager
// import here would bundle the emoji picker (and its grid/search/skin-tone
// UI) into the main chunk for every session — deferred until the picker
// itself is actually opened, which is already gated by pickerOpen() below.
const FloatingEmojiPicker = lazy(() => import("./FloatingEmojiPicker"));

export default function MessageActionsBar(props: {
  channelId: string;
  msg: Message;
  threadTs?: string;
  onOpenThread?: (ts: string) => void;
  onReplyLink?: (msg: Message) => void;
  onEditRequest: () => void;
  // Only the currently roving-focused row's buttons stay in Tab order — with
  // every message row contributing this toolbar, leaving them all tabbable
  // would turn Tab through the list into 4-5 stops per message. They're
  // still fully reachable: the row's own r/a/s/p/./etc. shortcuts, and once
  // the row is focused these buttons rejoin Tab order to reach for a mouse.
  rowFocused: () => boolean;
}) {
  const [pickerOpen, setPickerOpen] = createSignal(false);
  const [moreOpen, setMoreOpen] = createSignal(false);
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this variable through the JSX ref attribute.
  let pickerWrapRef: HTMLDivElement | undefined;

  const togglePicker = () => {
    setPickerOpen(!pickerOpen());
  };

  const toggleMore = () => {
    // client.appCommands can be several megabytes. Fetch it only after the
    // user asks for this overflow menu, not while the page is loading.
    store.resources.loadMessageShortcuts();
    setMoreOpen(!moreOpen());
  };

  // A broadcasted reply's own ts is just where it landed in the channel —
  // its actual thread lives at threadTs, so "reply in thread" must jump
  // there instead of opening a new thread rooted on the broadcast itself.
  const threadRootTs = createMemo(() =>
    props.msg.isBroadcast && props.msg.threadTs ? props.msg.threadTs : props.msg.ts,
  );

  const isSaved = createMemo(() => store.later.isSavedForLater(props.channelId, props.msg.ts));

  const react = (name: string) => {
    store.messages.reactToMessage(props.channelId, props.msg, name);
    setPickerOpen(false);
  };

  return (
    <div class="message-hover-actions" classList={{ "force-visible": pickerOpen() || moreOpen() }}>
      <div class="message-hover-picker-wrap" ref={pickerWrapRef}>
        <Tooltip content="React">
          <button
            aria-label="React"
            class="message-hover-btn btn-reset flex-center"
            onClick={togglePicker}
            tabIndex={props.rowFocused() ? undefined : -1}
            type="button"
          >
            <Icon name="emoji" size={16} />
          </button>
        </Tooltip>
        <Show when={pickerOpen()}>
          <FloatingEmojiPicker
            anchor={() => pickerWrapRef}
            onClose={() => setPickerOpen(false)}
            onSelect={react}
            open
          />
        </Show>
      </div>

      <Show when={props.onOpenThread}>
        <Tooltip content="Reply in thread">
          <button
            aria-label="Reply in thread"
            class="message-hover-btn btn-reset flex-center"
            onClick={() => props.onOpenThread?.(threadRootTs())}
            tabIndex={props.rowFocused() ? undefined : -1}
            type="button"
          >
            <Icon name="threads" size={16} />
          </button>
        </Tooltip>
      </Show>

      <Show when={props.onReplyLink}>
        <Tooltip content="Reply">
          <button
            aria-label="Reply"
            class="message-hover-btn btn-reset flex-center"
            onClick={() => props.onReplyLink?.(props.msg)}
            tabIndex={props.rowFocused() ? undefined : -1}
            type="button"
          >
            <Icon name="email-reply" size={16} />
          </button>
        </Tooltip>
      </Show>

      <Tooltip content={isSaved() ? "Remove from Later" : "Save for later"}>
        <button
          aria-label={isSaved() ? "Remove from Later" : "Save for later"}
          class="message-hover-btn btn-reset flex-center"
          classList={{ active: isSaved() }}
          disabled={
            store.later.laterLoading() ||
            store.later.isSaveForLaterPending(props.channelId, props.msg.ts)
          }
          onClick={() => store.later.toggleSaveForLater(props.channelId, props.msg.ts)}
          tabIndex={props.rowFocused() ? undefined : -1}
          type="button"
        >
          <Icon name={isSaved() ? "bookmark-filled" : "bookmark"} size={15} />
        </button>
      </Tooltip>

      <Menu
        align="end"
        class="message-hover-picker-wrap"
        onClose={() => setMoreOpen(false)}
        open={moreOpen()}
        panelClass="menu-panel message-more-menu"
        trigger={
          <Tooltip content="More actions">
            <button
              aria-label="More actions"
              class="message-hover-btn btn-reset flex-center"
              onClick={toggleMore}
              tabIndex={props.rowFocused() ? undefined : -1}
              type="button"
            >
              <Icon name="ellipsis-vertical-filled" size={16} />
            </button>
          </Tooltip>
        }
      >
        <MessageActionsMenuItems
          channelId={props.channelId}
          msg={props.msg}
          onClose={() => setMoreOpen(false)}
          onEditRequest={props.onEditRequest}
          threadTs={props.threadTs}
        />
      </Menu>
    </div>
  );
}
