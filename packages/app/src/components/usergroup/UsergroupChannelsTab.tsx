import { Icon, Switch } from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import { channelDisplayName, store } from "../../lib/store";
import {
  addUsergroupChannels,
  removeUsergroupChannel,
  setUsergroupChannelSectionEnabled,
} from "../../lib/usergroupDetails";
import ComposeChannelPicker from "../composer/popovers/ComposeChannelPicker";
import RemoveRowButton from "./RemoveRowButton";
import "./UsergroupDetails.css";

export default function UsergroupChannelsTab(props: {
  channelIds: string[];
  disabled: boolean;
  sectionEnabled: boolean;
  usergroupId: string;
}) {
  const [query, setQuery] = createSignal("");
  const [addingChannel, setAddingChannel] = createSignal(false);

  const channels = createMemo(() =>
    props.channelIds.map((id) => ({ channel: store.channels.channelById(id), id })),
  );

  const filteredChannels = createMemo(() => {
    const q = query().trim().toLowerCase();
    if (!q) return channels();
    return channels().filter(({ id, channel }) =>
      channelDisplayName(channel, id).toLowerCase().includes(q),
    );
  });

  const addChannel = async (channelId: string) => {
    if (props.disabled) return;
    setAddingChannel(false);
    await addUsergroupChannels(props.usergroupId, [channelId]);
  };

  const removeChannel = async (id: string, name: string) => {
    if (props.disabled) return;
    // biome-ignore lint/suspicious/noAlert: Removing a default channel requires explicit confirmation.
    if (!confirm(`Remove #${name} as a default channel for this pinggroup?`)) return;
    await removeUsergroupChannel(props.usergroupId, id);
  };

  return (
    <div class="usergroup-details-tab-content flex-col">
      <div class="usergroup-details-section-setting flex-between">
        <div class="flex-col">
          <span class="usergroup-details-section-setting-title">
            Add group channels as a section in Home
          </span>
          <span class="usergroup-details-section-setting-hint text-dim">
            {props.channelIds.length > 0
              ? "Show these default channels together for group members."
              : "Add at least one default channel to enable this section."}
          </span>
        </div>
        <Switch
          checked={props.sectionEnabled}
          disabled={props.disabled || props.channelIds.length === 0}
          onChange={(enabled) => void setUsergroupChannelSectionEnabled(props.usergroupId, enabled)}
          title="Add group channels as a section in Home"
        />
      </div>
      <div class="usergroup-details-list-bar">
        <input
          class="usergroup-details-input"
          disabled={props.disabled}
          onInput={(e) => setQuery(e.currentTarget.value)}
          placeholder="Find channels"
          type="text"
          value={query()}
        />
        <button
          class="usergroup-details-add-btn btn-reset flex-align-center"
          disabled={props.disabled}
          onClick={() => setAddingChannel(true)}
          type="button"
        >
          <Icon name="channel-add" size={15} /> Add channel
        </button>
      </div>
      <Show when={addingChannel()}>
        <div class="usergroup-details-picker">
          <ComposeChannelPicker
            excludeChannelIds={props.channelIds}
            onClose={() => setAddingChannel(false)}
            onSelect={addChannel}
          />
        </div>
      </Show>
      <div class="flex-col">
        <For
          each={filteredChannels()}
          fallback={<p class="usergroup-details-empty">No default channels.</p>}
        >
          {({ id, channel }) => (
            <div class="usergroup-details-row">
              <button
                class="usergroup-details-row-main btn-reset flex-align-center"
                onClick={() => store.viewState.setActiveView({ id, kind: "channel" })}
                type="button"
              >
                <Show
                  fallback={<span class="usergroup-details-row-hash">#</span>}
                  when={channel?.private}
                >
                  <Icon name="lock" size={13} />
                </Show>
                <span class="usergroup-details-row-name truncate">
                  {channelDisplayName(channel, id)}
                </span>
              </button>
              <RemoveRowButton
                disabled={props.disabled}
                label="Remove channel"
                onClick={() => removeChannel(id, channelDisplayName(channel, id))}
              />
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
