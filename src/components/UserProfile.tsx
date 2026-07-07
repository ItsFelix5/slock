import { Show, createMemo, createSignal } from 'solid-js';
import { profileUserId, closeUserProfile, userById, currentUser, openDmWithUser } from '../store';
import Icon from '../icons';
import Settings from './Settings';
import EmojiText from './EmojiText';
import Pronouns from './Pronouns';
import { useEscapeClose } from '../useEscapeClose';
import './UserProfile.css';

export default function UserProfile() {
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  useEscapeClose(() => (settingsOpen() ? setSettingsOpen(false) : closeUserProfile()));

  const user = createMemo(() => {
    const id = profileUserId();
    return id ? userById(id) : undefined;
  });

  const isSelf = createMemo(() => user()?.id === currentUser()?.id);

  const localTime = createMemo(() => {
    const tz = user()?.tz;
    if (!tz) return null;
    try {
      return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: tz });
    } catch {
      return null;
    }
  });

  return (
    <Show when={user()}>
      {(u) => (
        <div class="user-profile-overlay" onClick={(e) => e.target === e.currentTarget && closeUserProfile()}>
          <div class="user-profile-card">
            <button class="user-profile-close" onClick={closeUserProfile} title="Close">
              ✕
            </button>
            <div class="user-profile-banner" />
            <div class="user-profile-body">
              <div class="user-profile-avatar" style={{ background: u().avatarColor }}>
                <Show when={u().avatarUrl} fallback={u().initials}>
                  {(url) => <img src={url()} alt="" />}
                </Show>
                <span class="user-profile-presence" classList={{ away: u().presence === 'away' }} />
              </div>
              <h2 class="user-profile-name">
                {u().name}
                {u().isBot ? ' (bot)' : ''}
                <Pronouns text={u().pronouns} />
              </h2>
              <Show when={u().title}>
                <p class="user-profile-title">{u().title}</p>
              </Show>
              <Show when={u().statusText}>
                <p class="user-profile-status">
                  <Show when={u().statusEmoji}>
                    <EmojiText text={u().statusEmoji!} />
                  </Show>
                  {u().statusText}
                </p>
              </Show>
              <Show when={localTime()}>
                <p class="user-profile-meta">
                  {localTime()} local time{u().tzLabel ? ` (${u().tzLabel})` : ''}
                </p>
              </Show>
              <div class="user-profile-actions">
                <Show
                  when={!isSelf()}
                  fallback={
                    <button class="user-profile-message-btn" onClick={() => setSettingsOpen(true)}>
                      <Icon name="moreVertical" size={15} />
                      Settings
                    </button>
                  }
                >
                  <button class="user-profile-message-btn" onClick={() => openDmWithUser(u().id)}>
                    <Icon name="dms" size={15} />
                    Message
                  </button>
                </Show>
              </div>
            </div>
          </div>
          <Show when={settingsOpen()}>
            <Settings onClose={() => setSettingsOpen(false)} />
          </Show>
        </div>
      )}
    </Show>
  );
}
