import { service } from "@slock/core/solid";
import { channelDisplayName, channelIconName } from "@slock/plugins/channels/client/api";
import { channelMatches } from "@slock/plugins/slack/client/api";
import type { ChannelId } from "@slock/types";
import { Icon } from "@slock/ui";
import { createMemo } from "solid-js";
import ComposePicker from "../../views/popovers/ComposePicker";
import "./ComposeUserPicker.css";

const channelsStore = service("channels");

interface PickerChannel {
  id: ChannelId;
  name: string;
  private: boolean;
}

export default function ComposeChannelPicker(props: {
  excludeChannelIds?: ChannelId[];
  onSelect: (channelId: ChannelId) => void;
  onClose: () => void;
}) {
  const localChannels = createMemo<PickerChannel[]>(() =>
    channelsStore
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
      matches={channelMatches}
      renderItem={(channel) => (
        <>
          <Icon name={channelIconName(channel.private)} size={12} />
          <span class="truncate">{channel.name}</span>
        </>
      )}
      searchingMessage="Searching…"
    />
  );
}
