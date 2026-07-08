import { EmojiText } from "@slock/blockkit";
import { createSignal, Show } from "solid-js";
import {
  clearMyStatus,
  currentUser,
  dndSnoozedUntil,
  endDnd,
  isDndActive,
  snoozeDnd,
  updateMyPresence,
  updateMyStatus,
} from "../../lib/store";
import EmojiPicker from "../composer/EmojiPicker";
import "./SettingsTabs.css";

const EXPIRATION_OPTIONS = [
  { label: "Don't clear", seconds: 0 },
  { label: "30 minutes", seconds: 30 * 60 },
  { label: "1 hour", seconds: 60 * 60 },
  { label: "4 hours", seconds: 4 * 60 * 60 },
  { label: "Today", seconds: -1 },
];

const DND_OPTIONS = [
  { label: "20 min", minutes: 20 },
  { label: "1 hour", minutes: 60 },
  { label: "3 hours", minutes: 180 },
];

export default function SettingsProfileTab() {
  const me = currentUser;
  const [statusText, setStatusText] = createSignal(me()?.statusText ?? "");
  const [statusEmoji, setStatusEmoji] = createSignal(me()?.statusEmoji ?? "");
  const [expiration, setExpiration] = createSignal(0);
  const [emojiOpen, setEmojiOpen] = createSignal(false);
  const [savingStatus, setSavingStatus] = createSignal(false);

  const dndUntilLabel = (): string => {
    const until = dndSnoozedUntil();
    if (!isDndActive() || !until) return "Pause notifications for a while.";
    return `On until ${new Date(until).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  };

  const expirationTimestamp = (): number => {
    const sel = expiration();
    if (sel === 0) return 0;
    if (sel === -1) return Math.floor(new Date().setHours(23, 59, 59, 999) / 1000);
    return Math.floor(Date.now() / 1000) + sel;
  };

  const saveStatus = async () => {
    setSavingStatus(true);
    await updateMyStatus(statusText(), statusEmoji(), expirationTimestamp());
    setSavingStatus(false);
  };

  const clear = async () => {
    setStatusText("");
    setStatusEmoji("");
    await clearMyStatus();
  };

  return (
    <>
      <h2>Profile</h2>

      <div class="settings-section">
        <div class="settings-row-label">Status</div>
        <div class="settings-status-row">
          <div class="settings-status-emoji-wrap">
            <button
              type="button"
              class="settings-status-emoji-btn"
              onClick={() => setEmojiOpen(!emojiOpen())}
            >
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
          <button
            type="button"
            class="settings-status-save"
            onClick={saveStatus}
            disabled={savingStatus()}
          >
            {savingStatus() ? "Saving…" : "Save status"}
          </button>
          <Show when={statusText() || statusEmoji()}>
            <button type="button" class="settings-status-clear" onClick={clear}>
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
            type="button"
            class="settings-toggle-btn"
            classList={{ active: me()?.presence !== "away" }}
            onClick={() => updateMyPresence("auto")}
          >
            Active
          </button>
          <button
            type="button"
            class="settings-toggle-btn"
            classList={{ active: me()?.presence === "away" }}
            onClick={() => updateMyPresence("away")}
          >
            Away
          </button>
        </div>
      </div>

      <div class="settings-row">
        <div>
          <div class="settings-row-label">Do Not Disturb</div>
          <div class="settings-row-hint">{dndUntilLabel()}</div>
        </div>
        <div class="settings-toggle-group">
          <Show
            when={!isDndActive()}
            fallback={
              <button type="button" class="settings-toggle-btn active" onClick={endDnd}>
                Turn off
              </button>
            }
          >
            {DND_OPTIONS.map((opt) => (
              <button
                type="button"
                class="settings-toggle-btn"
                onClick={() => snoozeDnd(opt.minutes)}
              >
                {opt.label}
              </button>
            ))}
          </Show>
        </div>
      </div>
    </>
  );
}
