import { service } from "@slock/core/solid";
import type { Channel, ChannelId } from "@slock/types";
import { Button, Icon, InlineFeedback, Switch } from "@slock/ui";
import type { JSX } from "@solidjs/web";
import { createSignal, For, Show } from "solid-js";
import { TAG_FILTERS } from "../../../activity/client/api";
import { channelDisplayName, channelIconName } from "../../../channels/client/api";
import { isNotificationKind } from "../classify";
import "./NotificationsTab.css";

const kindRows = TAG_FILTERS.flatMap(({ icon, key, label }) =>
  isNotificationKind(key) ? [{ icon, key, label }] : [],
);

const feedback = service("feedback");

const bootstrapStore = service("bootstrap");
const prefsStore = service("prefs");
const channelsStore = service("channels");

const mutedChannels = () => channelsStore.channels().filter((c) => prefsStore.isChannelMuted(c.id));
const notifyAllChannels = () =>
  channelsStore.channels().filter((c) => prefsStore.isChannelNotifyAll(c.id));

const notifications = service("notifications");

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

function ChannelListSection(props: {
  channels: Channel[];
  empty: string;
  isPending: (id: ChannelId) => boolean;
  onRemove: (id: ChannelId) => void;
  title: string;
}) {
  return (
    <div class="settings-section">
      <div class="settings-section-title">{props.title}</div>
      <Show
        fallback={<div class="settings-list-empty text-dim text-sm">{props.empty}</div>}
        when={props.channels.length > 0}
      >
        <div class="settings-list flex-col">
          <For each={props.channels}>
            {(c) => (
              <div class="settings-list-row flex-between">
                <span class="settings-list-row-name flex-align-center">
                  <Icon name={channelIconName(c.private, c.archived)} size={12} />{" "}
                  <span class="truncate">{channelDisplayName(c)}</span>
                </span>
                <InlineFeedback
                  class="settings-list-row-feedback truncate"
                  feedback={feedback.get(c.id)}
                  priority={2}
                />
                <RowAction disabled={props.isPending(c.id)} onClick={() => props.onRemove(c.id)}>
                  <Icon name="close" size={12} />
                </RowAction>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

export default function NotificationsTab() {
  const [newWord, setNewWord] = createSignal("");

  const submitNewWord = async (event: Event) => {
    event.preventDefault();
    const word = newWord().trim();
    if (!word) return;
    if (await prefsStore.addHighlightWord(word)) setNewWord("");
  };

  return (
    <>
      <h2>Notifications</h2>

      <Show when={bootstrapStore.userPrefs().error}>
        <div class="settings-preferences-error flex-between">
          <span>Couldn't load your saved preferences. Changes are disabled to protect them.</span>
          <Button
            disabled={bootstrapStore.userPrefs().refreshing}
            onClick={() => void bootstrapStore.retryUserPrefs()}
            size="sm"
          >
            {bootstrapStore.userPrefs().refreshing ? "Retrying…" : "Try again"}
          </Button>
        </div>
      </Show>

      <Show when={notifications.supported}>
        <div class="settings-section">
          <div class="settings-row flex-between">
            <div class="settings-row-label">Desktop notifications</div>
            <Show
              fallback={
                <Show
                  fallback={
                    <RowAction
                      disabled={!prefsStore.preferencesReady()}
                      onClick={notifications.requestPermission}
                    >
                      Enable
                    </RowAction>
                  }
                  when={notifications.permission() === "denied"}
                >
                  <span class="settings-row-meta text-dim">Blocked in browser settings</span>
                </Show>
              }
              when={notifications.permission() === "granted"}
            >
              <Switch
                checked={notifications.enabled()}
                disabled={!prefsStore.preferencesReady()}
                onChange={notifications.setNotificationsEnabled}
              />
            </Show>
          </div>
          <InlineFeedback feedback={feedback.get("desktop-notifications")} />
        </div>
      </Show>

      <div class="settings-section">
        <div class="settings-section-title">Notify me about</div>
        <div class="settings-list flex-col">
          <For each={kindRows}>
            {(row) => (
              <div class="settings-list-row flex-between">
                <span class="settings-list-row-name flex-align-center">
                  <Icon name={row.icon} size={12} /> <span class="truncate">{row.label}</span>
                </span>
                <Switch
                  checked={notifications.isKindEnabled(row.key)}
                  onChange={(on) => notifications.setKindEnabled(row.key, on)}
                />
              </div>
            )}
          </For>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Pingwords</div>
        <form class="settings-add-row flex-align-center" onSubmit={submitNewWord}>
          <input
            class="text-field"
            disabled={prefsStore.isHighlightWordsPending()}
            onInput={(event) => setNewWord(event.currentTarget.value)}
            placeholder="Add a word or phrase"
            type="text"
            value={newWord()}
          />
          <RowAction
            disabled={!newWord().trim() || prefsStore.isHighlightWordsPending()}
            type="submit"
          >
            Add
          </RowAction>
        </form>
        <InlineFeedback feedback={feedback.get("pingwords")} />
        <Show
          fallback={<div class="settings-list-empty text-dim text-sm">No pingwords yet.</div>}
          when={prefsStore.highlightWords().length > 0}
        >
          <div class="settings-list flex-col">
            <For each={prefsStore.highlightWords()}>
              {(word) => (
                <div class="settings-list-row flex-between">
                  <span class="settings-list-row-name">{word}</span>
                  <RowAction
                    disabled={prefsStore.isHighlightWordsPending()}
                    onClick={() => prefsStore.removeHighlightWord(word)}
                  >
                    <Icon name="close" size={12} />
                  </RowAction>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      <ChannelListSection
        channels={notifyAllChannels()}
        empty="No channels set to notify for all messages."
        isPending={(id) => prefsStore.isNotifyAllPending(id)}
        onRemove={(id) => prefsStore.toggleNotifyAllChannel(id)}
        title="Notify for all messages"
      />

      <ChannelListSection
        channels={mutedChannels()}
        empty="No muted channels."
        isPending={() => prefsStore.isMutePending()}
        onRemove={(id) => prefsStore.toggleMuteChannel(id)}
        title="Muted channels"
      />
    </>
  );
}
