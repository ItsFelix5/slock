import { fetchBrowsableChannels } from "@slock/slack-api";
import { Icon } from "@slock/ui";
import { createMemo, Show } from "solid-js";
import { channelDisplayName, store } from "../../../lib/store";
import ComposePicker from "./ComposePicker";
import "./ComposeUserPicker.css";

interface PickerChannel {
  id: string;
  name: string;
  private: boolean;
}

export default function ComposeChannelPicker(props: {
  excludeChannelIds?: string[];
  onSelect: (channelId: string) => void;
  onClose: () => void;
}) {
  const localChannels = createMemo<PickerChannel[]>(() =>
    store.channels
      .channels()
      .filter((c) => !props.excludeChannelIds?.includes(c.id))
      .map((c) => ({ id: c.id, name: channelDisplayName(c), private: c.private })),
  );

  return (
    <ComposePicker<PickerChannel>
      ariaLabel="Find a channel"
      emptyMessage="No matches"
      excludeIds={props.excludeChannelIds}
      localItems={localChannels}
      notFoundMessage="Couldn't load channels"
      onClose={props.onClose}
      onSelect={props.onSelect}
      placeholder="Find a channel…"
      remoteSearch={async (query) => {
        const results = await fetchBrowsableChannels(query);
        return results.map((c) => ({
          id: c.id,
          name: c.name,
          private: c.private,
        }));
      }}
      renderItem={(channel) => (
        <>
          <Show fallback="#" when={channel.private}>
            <Icon name="lock" size={12} />
          </Show>
          {channel.name}
        </>
      )}
      searchingMessage="Searching…"
    />
  );
}
