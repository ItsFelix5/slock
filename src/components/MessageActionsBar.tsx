import { For, Show, createMemo, createSignal } from 'solid-js';
import {
  currentUser,
  reactToMessage,
  deleteMessageAt,
  savedTs,
  toggleSaveForLater,
  type MessageLocation,
} from '../store';
import type { Message } from '../types';
import EmojiText from './EmojiText';
import Icon from '../icons';

const QUICK_REACTIONS = ['+1', 'heart', 'joy', 'tada', 'eyes', 'white_check_mark'];

export default function MessageActionsBar(props: {
  channelId: string;
  location: MessageLocation;
  msg: Message;
  onOpenThread?: (ts: string) => void;
  onEditRequest: () => void;
}) {
  const [pickerOpen, setPickerOpen] = createSignal(false);
  const [moreOpen, setMoreOpen] = createSignal(false);

  const isMine = createMemo(() => currentUser()?.id === props.msg.userId);
  const isSaved = createMemo(() => !!savedTs[props.msg.ts]);

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

  return (
    <div class="message-hover-actions" classList={{ forceVisible: pickerOpen() || moreOpen() }}>
      <div class="message-hover-picker-wrap">
        <button class="message-hover-btn" title="React" onClick={() => setPickerOpen(!pickerOpen())}>
          <Icon name="emoji" size={16} />
        </button>
        <Show when={pickerOpen()}>
          <div class="reaction-picker">
            <For each={QUICK_REACTIONS}>
              {(name) => (
                <button
                  class="reaction-picker-btn"
                  onClick={() => {
                    reactToMessage(props.location, props.channelId, props.msg, name);
                    setPickerOpen(false);
                  }}
                >
                  <EmojiText text={`:${name}:`} />
                </button>
              )}
            </For>
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
        <button class="message-hover-btn" title="More actions" onClick={() => setMoreOpen(!moreOpen())}>
          <Icon name="moreVertical" size={16} />
        </button>
        <Show when={moreOpen()}>
          <div class="message-more-menu">
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
