import { Icon, InlineFeedback, Switch } from "@slock/ui";
import { createSignal, For, Show } from "solid-js";
import { actionFeedback, channelDisplayName, store } from "../../lib/store";
import "./Settings.css";

export default function SettingsNotificationsTab() {
  const [newWord, setNewWord] = createSignal("");

  const submitNewWord = (event: Event) => {
    event.preventDefault();
    const word = newWord().trim();
    if (!word) return;
    store.preferences.addHighlightWord(word);
    setNewWord("");
  };

  return (
    <>
      <h2>Notifications</h2>

      <Show when={store.desktopNotifications.supported}>
        <div class="settings-section">
          <div class="settings-row flex-between">
            <div>
              <div class="settings-row-label">Desktop notifications</div>
              <div class="settings-row-hint text-dim">
                Pop a notification for direct mentions and DMs when this tab isn't focused.
              </div>
            </div>
            <Show
              fallback={
                <Show
                  fallback={
                    <button
                      class="settings-list-row-action btn-reset text-muted"
                      onClick={store.desktopNotifications.requestPermission}
                      type="button"
                    >
                      Enable
                    </button>
                  }
                  when={store.desktopNotifications.permission() === "denied"}
                >
                  <span class="settings-row-hint text-dim">Blocked in browser settings</span>
                </Show>
              }
              when={store.desktopNotifications.permission() === "granted"}
            >
              <Switch
                checked={store.desktopNotifications.enabled()}
                onChange={store.desktopNotifications.setNotificationsEnabled}
              />
            </Show>
          </div>
          <InlineFeedback feedback={actionFeedback.get("desktop-notifications")} />
        </div>
      </Show>

      <div class="settings-section">
        <div class="settings-row-label">Muted channels</div>
        <div class="settings-row-hint text-dim">
          You won't see unread badges or mentions for these.
        </div>
        <Show
          fallback={<div class="settings-list-empty text-dim text-sm">No muted channels.</div>}
          when={store.preferences.mutedChannels().length > 0}
        >
          <div class="settings-list flex-col">
            <For each={store.preferences.mutedChannels()}>
              {(c) => (
                <div class="settings-list-row flex-between">
                  <span class="settings-list-row-name flex-align-center">
                    {c.private ? <Icon name="lock" size={12} /> : "#"} {channelDisplayName(c)}
                  </span>
                  <InlineFeedback feedback={actionFeedback.get(c.id)} priority={2} />
                  <button
                    class="settings-list-row-action btn-reset text-muted"
                    onClick={() => store.preferences.toggleMuteChannel(c.id)}
                    type="button"
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
        <div class="settings-row-hint text-dim">
          These channels ping you for every new message instead of just mentions.
        </div>
        <Show
          fallback={
            <div class="settings-list-empty text-dim text-sm">
              No channels set to notify for all messages.
            </div>
          }
          when={store.preferences.notifyAllChannels().length > 0}
        >
          <div class="settings-list flex-col">
            <For each={store.preferences.notifyAllChannels()}>
              {(c) => (
                <div class="settings-list-row flex-between">
                  <span class="settings-list-row-name flex-align-center">
                    {c.private ? <Icon name="lock" size={12} /> : "#"} {channelDisplayName(c)}
                  </span>
                  <button
                    class="settings-list-row-action btn-reset text-muted"
                    onClick={() => store.preferences.toggleNotifyAllChannel(c.id)}
                    type="button"
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
        <div class="settings-row-hint text-dim">
          Ping you like an @mention whenever one of these words appears in a message, even in
          channels you'd otherwise get no activity from.
        </div>
        <form class="settings-add-row flex-align-center" onSubmit={submitNewWord}>
          <input
            class="search-input"
            onInput={(event) => setNewWord(event.currentTarget.value)}
            placeholder="Add a word or phrase"
            type="text"
            value={newWord()}
          />
          <button
            class="settings-list-row-action btn-reset text-muted"
            disabled={!newWord().trim()}
            type="submit"
          >
            Add
          </button>
        </form>
        <InlineFeedback feedback={actionFeedback.get("pingwords")} />
        <Show
          fallback={<div class="settings-list-empty text-dim text-sm">No pingwords yet.</div>}
          when={store.preferences.highlightWords().length > 0}
        >
          <div class="settings-list flex-col">
            <For each={store.preferences.highlightWords()}>
              {(word) => (
                <div class="settings-list-row flex-between">
                  <span class="settings-list-row-name">{word}</span>
                  <button
                    class="settings-list-row-action btn-reset text-muted"
                    onClick={() => store.preferences.removeHighlightWord(word)}
                    type="button"
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
