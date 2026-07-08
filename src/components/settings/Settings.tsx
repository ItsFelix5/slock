import { For, Show, createSignal } from 'solid-js';
import { theme, setTheme, compactMode, setCompactMode } from '../../lib/theme';
import {
  currentUser,
  updateMyStatus,
  clearMyStatus,
  updateMyPresence,
  isDndActive,
  dndSnoozedUntil,
  snoozeDnd,
  endDnd,
  mutedChannels,
  notifyAllChannels,
  toggleMuteChannel,
  toggleNotifyAllChannel,
} from '../../lib/store';
import EmojiPicker from '../composer/EmojiPicker';
import EmojiText from '../messages/EmojiText';
import Icon from '../../icons';
import { useEscapeClose } from '../../hooks/useEscapeClose';
import './Settings.css';

const EXPIRATION_OPTIONS = [
  { label: "Don't clear", seconds: 0 },
  { label: '30 minutes', seconds: 30 * 60 },
  { label: '1 hour', seconds: 60 * 60 },
  { label: '4 hours', seconds: 4 * 60 * 60 },
  { label: 'Today', seconds: -1 },
];

const DND_OPTIONS = [
  { label: '20 min', minutes: 20 },
  { label: '1 hour', minutes: 60 },
  { label: '3 hours', minutes: 180 },
];

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: 'Ctrl/⌘ K', label: 'Open the quick switcher (jump to a channel or person)' },
  { keys: 'Enter', label: 'Send the message in the composer' },
  { keys: 'Shift Enter', label: 'Insert a new line in the composer' },
  { keys: 'Escape', label: 'Close whatever panel or dialog is open' },
];

type Tab = 'profile' | 'notifications' | 'appearance' | 'shortcuts';

const TABS: { key: Tab; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'appearance', label: 'Appearance' },
  { key: 'shortcuts', label: 'Shortcuts' },
];

export default function Settings(props: { onClose: () => void }) {
  useEscapeClose(props.onClose);

  const me = currentUser;
  const [tab, setTab] = createSignal<Tab>('profile');
  const [statusText, setStatusText] = createSignal(me()?.statusText ?? '');
  const [statusEmoji, setStatusEmoji] = createSignal(me()?.statusEmoji ?? '');
  const [expiration, setExpiration] = createSignal(0);
  const [emojiOpen, setEmojiOpen] = createSignal(false);
  const [savingStatus, setSavingStatus] = createSignal(false);

  const expirationTimestamp = (): number => {
    const sel = expiration();
    if (sel === 0) return 0; // don't clear
    if (sel === -1) return Math.floor(new Date().setHours(23, 59, 59, 999) / 1000); // end of today (absolute)
    return Math.floor(Date.now() / 1000) + sel; // relative seconds from now
  };

  const saveStatus = async () => {
    setSavingStatus(true);
    await updateMyStatus(statusText(), statusEmoji(), expirationTimestamp());
    setSavingStatus(false);
  };

  const clear = async () => {
    setStatusText('');
    setStatusEmoji('');
    await clearMyStatus();
  };

  return (
    <div class="settings-overlay" onClick={(e) => e.target === e.currentTarget && props.onClose()}>
      <div class="settings-card">
        <button class="settings-close" onClick={props.onClose} title="Close">
          ✕
        </button>

        <div class="settings-nav">
          <For each={TABS}>
            {(t) => (
              <button class="settings-nav-btn" classList={{ active: tab() === t.key }} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            )}
          </For>
        </div>

        <div class="settings-content">
          <Show when={tab() === 'profile'}>
            <h2>Profile</h2>

            <div class="settings-section">
              <div class="settings-row-label">Status</div>
              <div class="settings-status-row">
                <div class="settings-status-emoji-wrap">
                  <button class="settings-status-emoji-btn" onClick={() => setEmojiOpen(!emojiOpen())}>
                    <Show when={statusEmoji()} fallback="🙂">
                      <EmojiText text={statusEmoji()} />
                    </Show>
                  </button>
                  <Show when={emojiOpen()}>
                    <div class="settings-status-emoji-popover">
                      <EmojiPicker
                        onSelect={(name) => {
                          setStatusEmoji(`:${name}:`);
                          setEmojiOpen(false);
                        }}
                        onClose={() => setEmojiOpen(false)}
                      />
                    </div>
                  </Show>
                </div>
                <input
                  class="settings-status-input"
                  type="text"
                  placeholder="What's your status?"
                  value={statusText()}
                  onInput={(e) => setStatusText(e.currentTarget.value)}
                />
              </div>
              <select
                class="settings-status-expiration"
                value={expiration()}
                onChange={(e) => setExpiration(Number(e.currentTarget.value))}
              >
                {EXPIRATION_OPTIONS.map((opt) => (
                  <option value={opt.seconds}>{opt.label}</option>
                ))}
              </select>
              <div class="settings-status-actions">
                <button class="settings-status-save" onClick={saveStatus} disabled={savingStatus()}>
                  {savingStatus() ? 'Saving…' : 'Save status'}
                </button>
                <Show when={statusText() || statusEmoji()}>
                  <button class="settings-status-clear" onClick={clear}>
                    Clear
                  </button>
                </Show>
              </div>
            </div>

            <div class="settings-row">
              <div>
                <div class="settings-row-label">Presence</div>
                <div class="settings-row-hint">Manually mark yourself away.</div>
              </div>
              <div class="settings-toggle-group">
                <button
                  class="settings-toggle-btn"
                  classList={{ active: me()?.presence !== 'away' }}
                  onClick={() => updateMyPresence('auto')}
                >
                  Active
                </button>
                <button
                  class="settings-toggle-btn"
                  classList={{ active: me()?.presence === 'away' }}
                  onClick={() => updateMyPresence('away')}
                >
                  Away
                </button>
              </div>
            </div>

            <div class="settings-row">
              <div>
                <div class="settings-row-label">Do Not Disturb</div>
                <div class="settings-row-hint">
                  {isDndActive() && dndSnoozedUntil()
                    ? `On until ${new Date(dndSnoozedUntil()!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                    : 'Pause notifications for a while.'}
                </div>
              </div>
              <div class="settings-toggle-group">
                <Show
                  when={!isDndActive()}
                  fallback={
                    <button class="settings-toggle-btn active" onClick={endDnd}>
                      Turn off
                    </button>
                  }
                >
                  {DND_OPTIONS.map((opt) => (
                    <button class="settings-toggle-btn" onClick={() => snoozeDnd(opt.minutes)}>
                      {opt.label}
                    </button>
                  ))}
                </Show>
              </div>
            </div>
          </Show>

          <Show when={tab() === 'notifications'}>
            <h2>Notifications</h2>

            <div class="settings-section">
              <div class="settings-row-label">Muted channels</div>
              <div class="settings-row-hint">You won't see unread badges or mentions for these.</div>
              <Show
                when={mutedChannels().length > 0}
                fallback={<div class="settings-list-empty">No muted channels.</div>}
              >
                <div class="settings-list">
                  <For each={mutedChannels()}>
                    {(c) => (
                      <div class="settings-list-row">
                        <span class="settings-list-row-name">
                          {c.private ? <Icon name="lock" size={12} /> : '#'} {c.name}
                        </span>
                        <button class="settings-list-row-action" onClick={() => toggleMuteChannel(c.id)}>
                          Unmute
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>

            <div class="settings-section">
              <div class="settings-row-label">Notify for all messages</div>
              <div class="settings-row-hint">
                These channels ping you for every new message instead of just mentions.
              </div>
              <Show
                when={notifyAllChannels().length > 0}
                fallback={<div class="settings-list-empty">No channels set to notify for all messages.</div>}
              >
                <div class="settings-list">
                  <For each={notifyAllChannels()}>
                    {(c) => (
                      <div class="settings-list-row">
                        <span class="settings-list-row-name">
                          {c.private ? <Icon name="lock" size={12} /> : '#'} {c.name}
                        </span>
                        <button class="settings-list-row-action" onClick={() => toggleNotifyAllChannel(c.id)}>
                          Reset to mentions only
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </Show>

          <Show when={tab() === 'appearance'}>
            <h2>Appearance</h2>

            <div class="settings-row">
              <div>
                <div class="settings-row-label">Theme</div>
                <div class="settings-row-hint">"System" follows your OS's light/dark setting.</div>
              </div>
              <div class="settings-toggle-group">
                <button class="settings-toggle-btn" classList={{ active: theme() === 'dark' }} onClick={() => setTheme('dark')}>
                  Dark
                </button>
                <button class="settings-toggle-btn" classList={{ active: theme() === 'light' }} onClick={() => setTheme('light')}>
                  Light
                </button>
                <button class="settings-toggle-btn" classList={{ active: theme() === 'system' }} onClick={() => setTheme('system')}>
                  System
                </button>
              </div>
            </div>

            <div class="settings-row">
              <div>
                <div class="settings-row-label">Compact messages</div>
                <div class="settings-row-hint">Tighter spacing between consecutive messages.</div>
              </div>
              <button
                class="settings-switch"
                classList={{ on: compactMode() }}
                onClick={() => setCompactMode(!compactMode())}
                title="Toggle compact mode"
              >
                <span class="settings-switch-knob" />
              </button>
            </div>
          </Show>

          <Show when={tab() === 'shortcuts'}>
            <h2>Shortcuts</h2>
            <div class="settings-list">
              <For each={SHORTCUTS}>
                {(s) => (
                  <div class="settings-list-row">
                    <span class="settings-list-row-name">{s.label}</span>
                    <kbd class="settings-kbd">{s.keys}</kbd>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
