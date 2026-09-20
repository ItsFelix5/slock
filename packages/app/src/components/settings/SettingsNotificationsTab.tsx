import { Button, Icon, InlineFeedback, Switch } from "@slock/ui";
import { createSignal, For, type JSX, Show } from "solid-js";
import { channelDisplayName, channelIconName } from "../../lib/displayName";
import { actionFeedback } from "../../lib/feedback";
import { store } from "../../lib/store";
import "./Settings.css";
import "./SettingsNotificationsTab.css";

function RowAction(props: {
  children: JSX.Element;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      class="settings-list-row-action btn-reset text-muted"
      disabled={props.disabled}
      onClick={props.onClick}
      type={props.type ?? "button"}
    >
      {props.children}
    </button>
  );
}

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
        <div class="settings-preferences-error flex-between">
          <span>Couldn't load your saved preferences. Changes are disabled to protect them.</span>
          <Button
            disabled={store.resources.userPrefs.isFetching}
            onClick={() => void store.resources.retryUserPrefs()}
            size="sm"
          >
            {store.resources.userPrefs.isFetching ? "Retrying…" : "Try again"}
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
                    <RowAction
                      disabled={!store.preferences.preferencesReady()}
                      onClick={store.desktopNotifications.requestPermission}
                    >
                      Enable
                    </RowAction>
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
                disabled={!store.preferences.preferencesReady()}
                onChange={store.desktopNotifications.setNotificationsEnabled}
              />
            </Show>
          </div>
          <InlineFeedback feedback={actionFeedback.get("desktop-notifications")} />
        </div>
      </Show>

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
          <RowAction
            disabled={!newWord().trim() || store.preferences.isHighlightWordsPending()}
            type="submit"
          >
            Add
          </RowAction>
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
                  <RowAction
                    disabled={store.preferences.isHighlightWordsPending()}
                    onClick={() => store.preferences.removeHighlightWord(word)}
                  >
                    Remove
                  </RowAction>
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
                    <Icon name={channelIconName(c.private)} size={12} /> {channelDisplayName(c)}
                  </span>
                  <InlineFeedback
                    class="settings-list-row-feedback"
                    feedback={actionFeedback.get(c.id)}
                    priority={2}
                  />
                  <RowAction
                    disabled={store.preferences.isNotifyAllPending(c.id)}
                    onClick={() => store.preferences.toggleNotifyAllChannel(c.id)}
                  >
                    Reset to mentions only
                  </RowAction>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

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
                    <Icon name={channelIconName(c.private)} size={12} /> {channelDisplayName(c)}
                  </span>
                  <InlineFeedback
                    class="settings-list-row-feedback"
                    feedback={actionFeedback.get(c.id)}
                    priority={2}
                  />
                  <RowAction
                    disabled={store.preferences.isMutePending(c.id)}
                    onClick={() => store.preferences.toggleMuteChannel(c.id)}
                  >
                    Unmute
                  </RowAction>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>
    </>
  );
}
