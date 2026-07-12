import { Icon, Switch } from "@slock/ui";
import { createSignal, For, Show } from "solid-js";
import {
  addHighlightWord,
  channelDisplayName,
  desktopNotificationPermission,
  desktopNotificationsEnabled,
  desktopNotificationsSupported,
  highlightWords,
  mutedChannels,
  notifyAllChannels,
  removeHighlightWord,
  requestDesktopNotificationPermission,
  setDesktopNotificationsEnabled,
  toggleMuteChannel,
  toggleNotifyAllChannel,
} from "../../lib/store";
import "./Settings.css";

export default function SettingsNotificationsTab() {
  const [newWord, setNewWord] = createSignal("");

  const submitNewWord = (e: Event) => {
    e.preventDefault();
    const word = newWord().trim();
    if (!word) return;
    addHighlightWord(word);
    setNewWord("");
  };

  return (
    <>
      <h2>Notifications</h2>

      <Show when={desktopNotificationsSupported}>
        <div class="settings-section">
          <div class="settings-row">
            <div>
              <div class="settings-row-label">Desktop notifications</div>
              <div class="settings-row-hint">
                Pop a notification for direct mentions and DMs when this tab isn't focused.
              </div>
            </div>
            <Show
              when={desktopNotificationPermission() === "granted"}
              fallback={
                <Show
                  when={desktopNotificationPermission() === "denied"}
                  fallback={
                    <button
                      type="button"
                      class="settings-list-row-action"
                      onClick={requestDesktopNotificationPermission}
                    >
                      Enable
                    </button>
                  }
                >
                  <span class="settings-row-hint">Blocked in browser settings</span>
                </Show>
              }
            >
              <Switch
                checked={desktopNotificationsEnabled()}
                onChange={setDesktopNotificationsEnabled}
              />
            </Show>
          </div>
        </div>
      </Show>

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
                    {c.private ? <Icon name="lock" size={12} /> : "#"} {channelDisplayName(c)}
                  </span>
                  <button
                    type="button"
                    class="settings-list-row-action"
                    onClick={() => toggleMuteChannel(c.id)}
                  >
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
          fallback={
            <div class="settings-list-empty">No channels set to notify for all messages.</div>
          }
        >
          <div class="settings-list">
            <For each={notifyAllChannels()}>
              {(c) => (
                <div class="settings-list-row">
                  <span class="settings-list-row-name">
                    {c.private ? <Icon name="lock" size={12} /> : "#"} {channelDisplayName(c)}
                  </span>
                  <button
                    type="button"
                    class="settings-list-row-action"
                    onClick={() => toggleNotifyAllChannel(c.id)}
                  >
                    Reset to mentions only
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      <div class="settings-section">
        <div class="settings-row-label">Pingwords</div>
        <div class="settings-row-hint">
          Ping you like an @mention whenever one of these words appears in a message, even in
          channels you'd otherwise get no activity from.
        </div>
        <form class="settings-add-row" onSubmit={submitNewWord}>
          <input
            class="search-input"
            type="text"
            placeholder="Add a word or phrase"
            value={newWord()}
            onInput={(e) => setNewWord(e.currentTarget.value)}
          />
          <button type="submit" class="settings-list-row-action" disabled={!newWord().trim()}>
            Add
          </button>
        </form>
        <Show
          when={highlightWords().length > 0}
          fallback={<div class="settings-list-empty">No pingwords yet.</div>}
        >
          <div class="settings-list">
            <For each={highlightWords()}>
              {(word) => (
                <div class="settings-list-row">
                  <span class="settings-list-row-name">{word}</span>
                  <button
                    type="button"
                    class="settings-list-row-action"
                    onClick={() => removeHighlightWord(word)}
                  >
                    Remove
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </>
  );
}
