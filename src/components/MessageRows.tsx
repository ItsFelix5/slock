import { For, Show, createMemo, createSignal } from 'solid-js';
import { userById, editMessageText, reactToMessage, type MessageLocation } from '../store';
import type { Message } from '../types';
import EmojiText from './EmojiText';
import MessageActionsBar from './MessageActionsBar';
import MessageEditForm from './MessageEditForm';
import ReactionRow from './ReactionRow';
import Icon from '../icons';
import './MessageList.css';

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
        const [isEditing, setIsEditing] = createSignal(false);

        return (
          <>
            <Show when={showDayDivider()}>
              <div class="day-divider">
                <span>{msg.day}</span>
              </div>
            </Show>
            <div class="message-row" classList={{ compact: sameAuthorAsPrev() }}>
              <MessageActionsBar
                channelId={props.channelId}
                location={props.location}
                msg={msg}
                onOpenThread={props.onOpenThread}
                onEditRequest={() => setIsEditing(true)}
              />
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
                    <MessageEditForm
                      initialText={msg.text}
                      onSave={(text) => {
                        editMessageText(props.location, props.channelId, msg.ts, text);
                        setIsEditing(false);
                      }}
                      onCancel={() => setIsEditing(false)}
                    />
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
                  <ReactionRow
                    reactions={msg.reactions!}
                    onToggle={(name) => reactToMessage(props.location, props.channelId, msg, name)}
                  />
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
