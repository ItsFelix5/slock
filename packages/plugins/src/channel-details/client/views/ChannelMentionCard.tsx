import type { MentionCardProps } from "@slock/plugins/composer/client/api";
import { Show } from "solid-js";
import ChannelHoverCard from "./ChannelHoverCard";

export default function ChannelMentionCard(props: MentionCardProps) {
  return (
    <Show when={props.kind === "channel" ? props.id : undefined}>
      {(channelId) => (
        <ChannelHoverCard
          anchor={props.anchor}
          channelId={channelId()}
          hoverIntent={props.hoverIntent}
        />
      )}
    </Show>
  );
}
