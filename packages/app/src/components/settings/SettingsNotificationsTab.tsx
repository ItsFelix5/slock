import { Button, Icon, InlineFeedback, Switch } from "@slock/ui";
import { createSignal, For, Show } from "solid-js";
import { actionFeedback, channelDisplayName, store } from "../../lib/store";
import "./Settings.css";
import "./SettingsNotificationsTab.css";

export default function SettingsNotificationsTab() {
  const [newWord, setNewWord] = createSignal("");

  const submitNewWord = async (event: Event) => {
    event.preventDefault();
    const word = newWord().trim();
    if (!word) return;
    if (await store.preferences.addHighlightWord(word)) setNewWord("");
  };

  return (
    <>
      <h2>Notifications</h2>

      <Show when={store.resources.userPrefs.error}>
        <div class="settings-preferences-error flex-between" role="alert">
          <span>Couldn’t load your saved preferences. Changes are disabled to protect them.</span>
          <Button
            disabled={store.resources.userPrefs.loading}
            onClick={() => void store.resources.retryUserPrefs()}
            size="sm"
            variant="ghost"
          >
            {store.resources.userPrefs.loading ? "Retrying…" : "Try again"}
          </Button>
        </div>
      </Show>

      <Show when={store.desktopNotifications.supported}>
        <div class="settings-section">
          <div class="settings-row flex-between">
            <div class="settings-row-label">Desktop notifications</div>
            <Show
              fallback={
                <Show
                  fallback={
                    <button
                      class="settings-list-row-action btn-reset text-muted"
                      disabled={!store.preferences.preferencesReady()}
                      onClick={store.desktopNotifications.requestPermission}
                      type="button"
                    >
                      Enable
                    </button>
                  }
                  when={store.desktopNotifications.permission() === "denied"}
                >
                  <span class="settings-row-meta text-dim">Blocked in browser settings</span>
                </Show>
              }
              when={store.desktopNotifications.permission() === "granted"}
            >
              <Switch
                checked={store.desktopNotifications.enabled()}
                disabled={
                  !store.preferences.preferencesReady() || store.desktopNotifications.isPending()
                }
                onChange={store.desktopNotifications.setNotificationsEnabled}
                title="Desktop notifications"
              />
            </Show>
          </div>
          <InlineFeedback feedback={actionFeedback.get("desktop-notifications")} />
        </div>
      </Show>

      <div class="settings-section">
        <div class="settings-row-label">Muted channels</div>
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
                  <InlineFeedback
                    class="settings-list-row-feedback"
                    feedback={actionFeedback.get(c.id)}
                    priority={2}
                  />
                  <button
                    class="settings-list-row-action btn-reset text-muted"
                    disabled={store.preferences.isMutePending(c.id)}
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
                  <InlineFeedback
                    class="settings-list-row-feedback"
                    feedback={actionFeedback.get(c.id)}
                    priority={2}
                  />
                  <button
                    class="settings-list-row-action btn-reset text-muted"
                    disabled={store.preferences.isNotifyAllPending(c.id)}
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
        <form class="settings-add-row flex-align-center" onSubmit={submitNewWord}>
          <input
            class="search-input"
            disabled={store.preferences.isHighlightWordsPending()}
            onInput={(event) => setNewWord(event.currentTarget.value)}
            placeholder="Add a word or phrase"
            type="text"
            value={newWord()}
          />
          <button
            class="settings-list-row-action btn-reset text-muted"
            disabled={!newWord().trim() || store.preferences.isHighlightWordsPending()}
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
                    disabled={store.preferences.isHighlightWordsPending()}
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
