import { Icon } from "@slock/ui";
import { For, Show } from "solid-js";
import {
  mutedChannels,
  notifyAllChannels,
  toggleMuteChannel,
  toggleNotifyAllChannel,
} from "../../lib/store";
import "./SettingsTabs.css";

export default function SettingsNotificationsTab() {
  return (
    <>
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
                    {c.private ? <Icon name="lock" size={12} /> : "#"} {c.name}
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
                    {c.private ? <Icon name="lock" size={12} /> : "#"} {c.name}
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
    </>
  );
}
