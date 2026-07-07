import { For, Show, createMemo, createSignal } from 'solid-js';
import { userById, editMessageText, reactToMessage, openUserProfile, type MessageLocation } from '../store';
import type { Message } from '../types';
import Mrkdwn from '../blockkit/mrkdwn';
import BlockKit from '../blockkit/BlockKit';
import MessageActionsBar from './MessageActionsBar';
import MessageEditForm from './MessageEditForm';
import MessageFiles from './MessageFiles';
import AttachmentCard from './AttachmentCard';
import SystemMessage from './SystemMessage';
import ReactionRow from './ReactionRow';
import Pronouns from './Pronouns';
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
          return !!p && p.userId === msg.userId && !showDayDivider() && p.kind === msg.kind;
        };
        // Bot messages carry their own username/icon rather than a real user id
        // (frequently a bot_id that isn't a resolvable user) — don't bounce that
        // through userById, which would just burn a wasted /api/user lookup.
        // Slackbot's own automated announcements are a special case: Slack delivers
        // them as bot_message with username "Slackbot" but no icons at all, so
        // resolve the real Slackbot user instead of falling back to a generic 🤖.
        const isSlackbot = () => msg.botName === 'Slackbot';
        const user = createMemo(() => {
          if (isSlackbot()) return userById('USLACKBOT');
          return msg.botName ? undefined : userById(msg.userId);
        });
        const displayName = () => msg.botName ?? user()?.name ?? 'Unknown';
        const avatarUrl = () => msg.botIcon ?? user()?.avatarUrl;
        const [isEditing, setIsEditing] = createSignal(false);

        return (
          <>
            <Show when={showDayDivider()}>
              <div class="day-divider">
                <span>{msg.day}</span>
              </div>
            </Show>
            <Show
              when={msg.kind !== 'system'}
              fallback={<SystemMessage text={msg.text} time={msg.time} />}
            >
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
                  <button
                    type="button"
                    class="message-avatar"
                    style={{ background: user()?.avatarColor ?? '#616061' }}
                    onClick={() => !msg.botName && openUserProfile(msg.userId)}
                  >
                    <Show when={avatarUrl()} fallback={msg.botName ? '🤖' : (user()?.initials ?? '?')}>
                      {(url) => <img class="message-avatar-img" src={url()} alt="" />}
                    </Show>
                  </button>
                </Show>
                <div class="message-body">
                  <Show when={!sameAuthorAsPrev()}>
                    <div class="message-meta">
                      <button
                        type="button"
                        class="message-author"
                        disabled={!!msg.botName}
                        onClick={() => !msg.botName && openUserProfile(msg.userId)}
                      >
                        {displayName()}
                      </button>
                      <Show when={msg.botName}>
                        <span class="message-bot-badge">APP</span>
                      </Show>
                      <Pronouns text={user()?.pronouns} />
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
                      <Show when={msg.blocks?.length} fallback={<Mrkdwn text={msg.text} />}>
                        <BlockKit blocks={msg.blocks!} />
                      </Show>
                      <Show when={msg.editedLocally}>
                        <span class="message-edited"> (edited)</span>
                      </Show>
                    </div>
                  </Show>

                  <Show when={msg.files?.length}>
                    <MessageFiles files={msg.files!} />
                  </Show>

                  <Show when={msg.attachments?.length}>
                    <For each={msg.attachments}>{(a) => <AttachmentCard attachment={a} />}</For>
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
            </Show>
          </>
        );
      }}
    </For>
  );
}
