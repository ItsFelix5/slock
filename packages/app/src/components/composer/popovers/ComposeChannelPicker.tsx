import { Icon } from "@slock/ui";
import { createMemo } from "solid-js";
import { fetchBrowsableChannels } from "../../../lib/api";
import { channelDisplayName, channelIconName } from "../../../lib/displayName";
import { store } from "../../../lib/store";
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
          <Icon name={channelIconName(channel.private)} size={12} />
          {channel.name}
        </>
      )}
      searchingMessage="Searching…"
    />
  );
}
