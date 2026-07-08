import { For, Show, createMemo, createSignal } from 'solid-js';
import {
  currentUser,
  reactToMessage,
  deleteMessageAt,
  isSavedForLater,
  toggleSaveForLater,
  openUserProfile,
  isMessagePinned,
  togglePinMessage,
  copyMessageLink,
  markMessageUnread,
  remindAboutMessage,
  REMINDER_OPTIONS,
  recordEmojiUse,
  type MessageLocation,
} from '../../lib/store';
import type { Message } from '../../lib/types';
import EmojiPicker from '../composer/EmojiPicker';
import Icon from '../../icons';

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
    if (confirm('Delete this message?')) deleteMessageAt(props.location, props.channelId, props.msg.ts);
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
    <div class="message-hover-actions" classList={{ forceVisible: pickerOpen() || moreOpen() }}>
      <div class="message-hover-picker-wrap">
        <button class="message-hover-btn" title="React" onClick={() => setPickerOpen(!pickerOpen())}>
          <Icon name="emoji" size={16} />
        </button>
        <Show when={pickerOpen()}>
          <div class="reaction-picker-full">
            <EmojiPicker onSelect={react} onClose={() => setPickerOpen(false)} />
          </div>
        </Show>
      </div>

      <Show when={props.onOpenThread}>
        <button class="message-hover-btn" title="Reply in thread" onClick={() => props.onOpenThread?.(props.msg.ts)}>
          <Icon name="threads" size={16} />
        </button>
      </Show>

      <button
        class="message-hover-btn"
        classList={{ active: isSaved() }}
        title={isSaved() ? 'Remove from Later' : 'Save for later'}
        onClick={() => toggleSaveForLater(props.channelId, props.msg.ts)}
      >
        <Icon name="bookmark" size={15} />
      </button>

      <div class="message-hover-picker-wrap">
        <button
          class="message-hover-btn"
          title="More actions"
          onClick={() => {
            setMoreOpen(!moreOpen());
            setRemindOpen(false);
          }}
        >
          <Icon name="moreVertical" size={16} />
        </button>
        <Show when={moreOpen()}>
          <div class="message-more-menu">
            <button class="message-more-item" onClick={copyLink}>
              Copy link
            </button>
            <button class="message-more-item" onClick={togglePin}>
              {isPinned() ? 'Unpin from channel' : 'Pin to channel'}
            </button>
            <div class="message-more-item-wrap">
              <button class="message-more-item" onClick={() => setRemindOpen(!remindOpen())}>
                Remind me about this…
              </button>
              <Show when={remindOpen()}>
                <div class="message-more-submenu">
                  <For each={REMINDER_OPTIONS}>
                    {(opt) => (
                      <button class="message-more-item" onClick={() => remind(opt.time)}>
                        {opt.label}
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </div>
            <button class="message-more-item" onClick={markUnread}>
              Mark unread
            </button>
            <button
              class="message-more-item"
              onClick={() => {
                setMoreOpen(false);
                openUserProfile(props.msg.userId);
              }}
            >
              View profile
            </button>
            <button class="message-more-item" onClick={copyText}>
              Copy text
            </button>
            <Show when={isMine()}>
              <button class="message-more-item" onClick={requestEdit}>
                Edit message
              </button>
              <button class="message-more-item danger" onClick={requestDelete}>
                Delete message
              </button>
            </Show>
          </div>
        </Show>
      </div>
    </div>
  );
}
