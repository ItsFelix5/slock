import type { Message } from "@slock/slack-api";
import { Icon, Menu } from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import {
  copyMessageLink,
  currentUser,
  deleteMessageAt,
  isMessagePinned,
  isSavedForLater,
  type MessageLocation,
  markMessageUnread,
  openUserProfile,
  REMINDER_OPTIONS,
  reactToMessage,
  recordEmojiUse,
  remindAboutMessage,
  togglePinMessage,
  toggleSaveForLater,
} from "../../lib/store";
import EmojiPicker from "../composer/EmojiPicker";

export default function MessageActionsBar(props: {
  channelId: string;
  location: MessageLocation;
  msg: Message;
  onOpenThread?: (ts: string) => void;
  onEditRequest: () => void;
}) {
  const [pickerOpen, setPickerOpen] = createSignal(false);
  const [moreOpen, setMoreOpen] = createSignal(false);
  const [remindOpen, setRemindOpen] = createSignal(false);

  const isMine = createMemo(() => currentUser()?.id === props.msg.userId);
  const isSaved = createMemo(() => isSavedForLater(props.msg.ts));
  const isPinned = createMemo(() => isMessagePinned(props.channelId, props.msg.ts));

  const copyText = () => {
    navigator.clipboard.writeText(props.msg.text);
    setMoreOpen(false);
  };

  const requestEdit = () => {
    setMoreOpen(false);
    props.onEditRequest();
  };

  const requestDelete = () => {
    setMoreOpen(false);
    if (confirm("Delete this message?"))
      deleteMessageAt(props.location, props.channelId, props.msg.ts);
  };

  const react = (name: string) => {
    recordEmojiUse(name);
    reactToMessage(props.location, props.channelId, props.msg, name);
    setPickerOpen(false);
  };

  const copyLink = () => {
    setMoreOpen(false);
    copyMessageLink(props.channelId, props.msg.ts);
  };

  const togglePin = () => {
    setMoreOpen(false);
    togglePinMessage(props.channelId, props.msg.ts);
  };

  const markUnread = () => {
    setMoreOpen(false);
    markMessageUnread(props.channelId, props.msg.ts);
  };

  const remind = (time: string) => {
    setMoreOpen(false);
    setRemindOpen(false);
    remindAboutMessage(props.channelId, props.msg.ts, time);
  };

  return (
    <div class="message-hover-actions" classList={{ "force-visible": pickerOpen() || moreOpen() }}>
      <div class="message-hover-picker-wrap">
        <button
          type="button"
          class="message-hover-btn"
          title="React"
          onClick={() => setPickerOpen(!pickerOpen())}
        >
          <Icon name="emoji" size={16} />
        </button>
        <Show when={pickerOpen()}>
          <div class="reaction-picker-full">
            <EmojiPicker onSelect={react} onClose={() => setPickerOpen(false)} />
          </div>
        </Show>
      </div>

      <Show when={props.onOpenThread}>
        <button
          type="button"
          class="message-hover-btn"
          title="Reply in thread"
          onClick={() => props.onOpenThread?.(props.msg.ts)}
        >
          <Icon name="threads" size={16} />
        </button>
      </Show>

      <button
        type="button"
        class="message-hover-btn"
        classList={{ active: isSaved() }}
        title={isSaved() ? "Remove from Later" : "Save for later"}
        onClick={() => toggleSaveForLater(props.channelId, props.msg.ts)}
      >
        <Icon name="bookmark" size={15} />
      </button>

      <Menu
        class="message-hover-picker-wrap"
        panelClass="message-more-menu"
        open={moreOpen()}
        onClose={() => {
          setMoreOpen(false);
          setRemindOpen(false);
        }}
        trigger={
          <button
            type="button"
            class="message-hover-btn"
            title="More actions"
            onClick={() => {
              setMoreOpen(!moreOpen());
              setRemindOpen(false);
            }}
          >
            <Icon name="ellipsis-vertical-filled" size={16} />
          </button>
        }
      >
        <button type="button" class="message-more-item" onClick={copyLink}>
          Copy link
        </button>
        <button type="button" class="message-more-item" onClick={togglePin}>
          {isPinned() ? "Unpin from channel" : "Pin to channel"}
        </button>
        <Menu
          class="message-more-item-wrap"
          panelClass="message-more-submenu"
          open={remindOpen()}
          onClose={() => setRemindOpen(false)}
          trigger={
            <button
              type="button"
              class="message-more-item"
              onClick={() => setRemindOpen(!remindOpen())}
            >
              Remind me about this…
            </button>
          }
        >
          <For each={REMINDER_OPTIONS}>
            {(opt) => (
              <button type="button" class="message-more-item" onClick={() => remind(opt.time)}>
                {opt.label}
              </button>
            )}
          </For>
        </Menu>
        <button type="button" class="message-more-item" onClick={markUnread}>
          Mark unread
        </button>
        <button
          type="button"
          class="message-more-item"
          onClick={() => {
            setMoreOpen(false);
            openUserProfile(props.msg.userId);
          }}
        >
          View profile
        </button>
        <button type="button" class="message-more-item" onClick={copyText}>
          Copy text
        </button>
        <Show when={isMine()}>
          <button type="button" class="message-more-item" onClick={requestEdit}>
            Edit message
          </button>
          <button type="button" class="message-more-item danger" onClick={requestDelete}>
            Delete message
          </button>
        </Show>
      </Menu>
    </div>
  );
}
