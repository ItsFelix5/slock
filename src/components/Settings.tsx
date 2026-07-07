import { Show, createSignal } from 'solid-js';
import { theme, setTheme, compactMode, setCompactMode } from '../theme';
import {
  currentUser,
  updateMyStatus,
  clearMyStatus,
  updateMyPresence,
  isDndActive,
  dndSnoozedUntil,
  snoozeDnd,
  endDnd,
} from '../store';
import EmojiPicker from './EmojiPicker';
import EmojiText from './EmojiText';
import { useEscapeClose } from '../useEscapeClose';
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

export default function Settings(props: { onClose: () => void }) {
  useEscapeClose(props.onClose);

  const me = currentUser;
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
        <h2>Settings</h2>

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

        <div class="settings-row">
          <div>
            <div class="settings-row-label">Theme</div>
            <div class="settings-row-hint">Applies immediately, saved on this device.</div>
          </div>
          <div class="settings-toggle-group">
            <button class="settings-toggle-btn" classList={{ active: theme() === 'dark' }} onClick={() => setTheme('dark')}>
              Dark
            </button>
            <button class="settings-toggle-btn" classList={{ active: theme() === 'light' }} onClick={() => setTheme('light')}>
              Light
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
      </div>
    </div>
  );
}
