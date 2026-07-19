import { Icon, Tooltip } from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import { channelDisplayName, store } from "../../lib/store";
import { addUsergroupChannels, removeUsergroupChannel } from "../../lib/usergroupDetails";
import ComposeChannelPicker from "../composer/popovers/ComposeChannelPicker";
import "./UsergroupDetails.css";

export default function UsergroupChannelsTab(props: { usergroupId: string; channelIds: string[] }) {
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
    setAddingChannel(false);
    await addUsergroupChannels(props.usergroupId, [channelId]);
  };

  const removeChannel = async (id: string, name: string) => {
    // biome-ignore lint/suspicious/noAlert: Removing a default channel requires explicit confirmation.
    if (!confirm(`Remove #${name} as a default channel for this pinggroup?`)) return;
    await removeUsergroupChannel(props.usergroupId, id);
  };

  return (
    <div class="usergroup-details-tab-content flex-col">
      <div class="usergroup-details-list-bar">
        <input
          class="usergroup-details-input"
          onInput={(e) => setQuery(e.currentTarget.value)}
          placeholder="Find channels"
          type="text"
          value={query()}
        />
        <button
          class="usergroup-details-add-btn btn-reset flex-align-center"
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
              <Tooltip content="Remove channel">
                <button
                  aria-label="Remove channel"
                  class="usergroup-details-row-remove btn-reset flex-center"
                  onClick={() => removeChannel(id, channelDisplayName(channel, id))}
                  type="button"
                >
                  <Icon name="close-filled" size={14} />
                </button>
              </Tooltip>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
