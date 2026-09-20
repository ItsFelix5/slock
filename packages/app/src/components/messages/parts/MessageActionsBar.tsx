import { IconButton, Menu } from "@slock/ui";
import { createMemo, createSignal, lazy, Show } from "solid-js";
import { isMine, type Message } from "../../../lib/api";
import { store } from "../../../lib/store";
import type { OpenThreadHandler } from "../messageFocus";
import MessageActionsMenuItems from "./MessageActionsMenuItems";

const FloatingEmojiPicker = lazy(() => import("./FloatingEmojiPicker"));

export default function MessageActionsBar(props: {
  channelId: string;
  msg: Message;
  threadTs?: string;
  onOpenThread?: OpenThreadHandler;
  onReplyLink?: (msg: Message) => void;
  onEditRequest: () => void;

  rowFocused: () => boolean;
}) {
  const [pickerOpen, setPickerOpen] = createSignal(false);
  const [moreOpen, setMoreOpen] = createSignal(false);

  let pickerWrapRef: HTMLDivElement | undefined;

  const togglePicker = () => {
    setPickerOpen(!pickerOpen());
  };

  const toggleMore = () => {
    store.resources.loadMessageShortcuts();
    setMoreOpen(!moreOpen());
  };

  const threadRootTs = createMemo(() =>
    props.msg.isBroadcast && props.msg.threadTs ? props.msg.threadTs : props.msg.ts,
  );

  const isSaved = createMemo(() => store.later.isSavedForLater(props.channelId, props.msg.ts));

  const existingReactions = createMemo(() => {
    const me = store.users.currentUser()?.id;
    return (props.msg.reactions ?? []).map((r) => ({
      mine: !!me && r.users.includes(me),
      name: r.name,
    }));
  });

  const react = (name: string) => {
    store.messages.reactToMessage(props.channelId, props.msg, name);
    setPickerOpen(false);
  };

  return (
    <div class="message-hover-actions" classList={{ "force-visible": pickerOpen() || moreOpen() }}>
      <Show when={isMine(props.msg)}>
        <IconButton
          class="message-hover-btn"
          icon="edit"
          label="Edit message"
          onClick={props.onEditRequest}
          tabIndex={props.rowFocused() ? undefined : -1}
        />
      </Show>

      <div class="message-hover-picker-wrap" ref={pickerWrapRef}>
        <IconButton
          class="message-hover-btn"
          icon="emoji"
          label="React"
          onClick={togglePicker}
          tabIndex={props.rowFocused() ? undefined : -1}
        />
        <Show when={pickerOpen()}>
          <FloatingEmojiPicker
            anchor={() => pickerWrapRef}
            existingReactions={existingReactions()}
            onClose={() => setPickerOpen(false)}
            onSelect={react}
            open
          />
        </Show>
      </div>

      <Show when={props.onOpenThread}>
        <IconButton
          class="message-hover-btn"
          icon="threads"
          label="Reply in thread"
          onClick={(e) => props.onOpenThread?.(threadRootTs(), { pinned: e.shiftKey })}
          tabIndex={props.rowFocused() ? undefined : -1}
        />
      </Show>

      <Show when={props.onReplyLink}>
        <IconButton
          class="message-hover-btn"
          icon="email-reply"
          label="Reply"
          onClick={() => props.onReplyLink?.(props.msg)}
          tabIndex={props.rowFocused() ? undefined : -1}
        />
      </Show>

      <IconButton
        active={isSaved()}
        class="message-hover-btn"
        disabled={
          store.later.laterLoading() ||
          store.later.isSaveForLaterPending(props.channelId, props.msg.ts)
        }
        icon={isSaved() ? "bookmark-filled" : "bookmark"}
        iconSize={15}
        label={isSaved() ? "Remove from Later" : "Save for later"}
        onClick={() => store.later.toggleSaveForLater(props.channelId, props.msg.ts)}
        tabIndex={props.rowFocused() ? undefined : -1}
      />

      <Menu
        align="end"
        class="message-hover-picker-wrap"
        onClose={() => setMoreOpen(false)}
        open={moreOpen()}
        panelClass="menu-panel message-more-menu"
        trigger={
          <IconButton
            class="message-hover-btn"
            icon="ellipsis-vertical-filled"
            label="More actions"
            onClick={toggleMore}
            tabIndex={props.rowFocused() ? undefined : -1}
          />
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
