import { For, Show, createMemo, createSignal } from 'solid-js';
import {
  userById,
  currentUser,
  reactToMessage,
  editMessageText,
  deleteMessageAt,
  savedTs,
  toggleSaveForLater,
  type MessageLocation,
} from '../store';
import type { Message } from '../types';
import EmojiText from './EmojiText';
import Icon from '../icons';
import './MessageList.css';

const QUICK_REACTIONS = ['+1', 'heart', 'joy', 'tada', 'eyes', 'white_check_mark'];

export default function MessageRows(props: {
  messages: Message[];
  channelId: string;
  location: MessageLocation;
  onOpenThread?: (ts: string) => void;
}) {
  return (
    <For each={props.messages}>
      {(msg, i) => {
        const prev = () => props.messages[i() - 1];
        const showDayDivider = () => {
          const p = prev();
          return !p || p.day !== msg.day;
        };
        const sameAuthorAsPrev = () => {
          const p = prev();
          return !!p && p.userId === msg.userId && !showDayDivider();
        };
        const user = createMemo(() => userById(msg.userId));
        const isMine = createMemo(() => currentUser()?.id === msg.userId);
        const isSaved = createMemo(() => !!savedTs[msg.ts]);

        const [pickerOpen, setPickerOpen] = createSignal(false);
        const [moreOpen, setMoreOpen] = createSignal(false);
        const [isEditing, setIsEditing] = createSignal(false);
        const [editText, setEditText] = createSignal(msg.text);

        const startEdit = () => {
          setEditText(msg.text);
          setIsEditing(true);
          setMoreOpen(false);
        };
        const saveEdit = () => {
          editMessageText(props.location, props.channelId, msg.ts, editText());
          setIsEditing(false);
        };
        const remove = () => {
          setMoreOpen(false);
          if (confirm('Delete this message?')) deleteMessageAt(props.location, props.channelId, msg.ts);
        };
        const copy = () => {
          navigator.clipboard.writeText(msg.text);
          setMoreOpen(false);
        };

        return (
          <>
            <Show when={showDayDivider()}>
              <div class="day-divider">
                <span>{msg.day}</span>
              </div>
            </Show>
            <div class="message-row" classList={{ compact: sameAuthorAsPrev() }}>
              <div class="message-hover-actions" classList={{ forceVisible: pickerOpen() || moreOpen() }}>
                <div class="message-hover-picker-wrap">
                  <button
                    class="message-hover-btn"
                    title="React"
                    onClick={() => setPickerOpen(!pickerOpen())}
                  >
                    <Icon name="emoji" size={16} />
                  </button>
                  <Show when={pickerOpen()}>
                    <div class="reaction-picker">
                      <For each={QUICK_REACTIONS}>
                        {(name) => (
                          <button
                            class="reaction-picker-btn"
                            onClick={() => {
                              reactToMessage(props.location, props.channelId, msg, name);
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
                  <button
                    class="message-hover-btn"
                    title="Reply in thread"
                    onClick={() => props.onOpenThread?.(msg.ts)}
                  >
                    <Icon name="threads" size={16} />
                  </button>
                </Show>
                <button
                  class="message-hover-btn"
                  classList={{ active: isSaved() }}
                  title={isSaved() ? 'Remove from Later' : 'Save for later'}
                  onClick={() => toggleSaveForLater(props.channelId, msg.ts)}
                >
                  <Icon name="bookmark" size={15} />
                </button>
                <div class="message-hover-picker-wrap">
                  <button class="message-hover-btn" title="More actions" onClick={() => setMoreOpen(!moreOpen())}>
                    <Icon name="moreVertical" size={16} />
                  </button>
                  <Show when={moreOpen()}>
                    <div class="message-more-menu">
                      <button class="message-more-item" onClick={copy}>
                        Copy text
                      </button>
                      <Show when={isMine()}>
                        <button class="message-more-item" onClick={startEdit}>
                          Edit message
                        </button>
                        <button class="message-more-item danger" onClick={remove}>
                          Delete message
                        </button>
                      </Show>
                    </div>
                  </Show>
                </div>
              </div>
              <Show
                when={!sameAuthorAsPrev()}
                fallback={<div class="message-avatar-spacer">{msg.time.split(' ')[0]}</div>}
              >
                <div class="message-avatar" style={{ background: user()?.avatarColor ?? '#616061' }}>
                  <Show when={user()?.avatarUrl} fallback={user()?.initials ?? '?'}>
                    {(url) => <img class="message-avatar-img" src={url()} alt="" />}
                  </Show>
                </div>
              </Show>
              <div class="message-body">
                <Show when={!sameAuthorAsPrev()}>
                  <div class="message-meta">
                    <span class="message-author">{user()?.name ?? 'Unknown'}</span>
                    <span class="message-time">{msg.time}</span>
                  </div>
                </Show>
                <Show
                  when={!isEditing()}
                  fallback={
                    <div class="message-edit">
                      <textarea
                        class="message-edit-input"
                        value={editText()}
                        onInput={(e) => setEditText(e.currentTarget.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            saveEdit();
                          } else if (e.key === 'Escape') {
                            setIsEditing(false);
                          }
                        }}
                        rows={1}
                        autofocus
                      />
                      <div class="message-edit-actions">
                        <button class="message-edit-save" onClick={saveEdit}>
                          Save
                        </button>
                        <button class="message-edit-cancel" onClick={() => setIsEditing(false)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  }
                >
                  <div class="message-text">
                    <EmojiText text={msg.text} />
                    <Show when={msg.editedLocally}>
                      <span class="message-edited"> (edited)</span>
                    </Show>
                  </div>
                </Show>
                <Show when={(msg.reactions?.length ?? 0) > 0}>
                  <div class="reaction-row">
                    <For each={msg.reactions}>
                      {(r) => {
                        const mine = createMemo(() => {
                          const me = currentUser();
                          return !!me && r.users.includes(me.id);
                        });
                        return (
                          <button
                            class="reaction-pill"
                            classList={{ mine: mine() }}
                            onClick={() => reactToMessage(props.location, props.channelId, msg, r.name)}
                          >
                            <EmojiText text={`:${r.name}:`} />
                            <span class="reaction-count">{r.count}</span>
                          </button>
                        );
                      }}
                    </For>
                  </div>
                </Show>
                <Show when={props.onOpenThread && (msg.replyCount ?? 0) > 0}>
                  <button class="message-replies" onClick={() => props.onOpenThread?.(msg.ts)}>
                    <Icon name="threads" size={14} /> {msg.replyCount}{' '}
                    {msg.replyCount === 1 ? 'reply' : 'replies'}
                  </button>
                </Show>
              </div>
            </div>
          </>
        );
      }}
    </For>
  );
}
