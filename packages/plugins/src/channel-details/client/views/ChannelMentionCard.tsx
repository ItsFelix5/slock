import { Show } from "solid-js";
import type { MentionCardProps } from "../../../composer/client/api";
import ChannelHoverCard from "./ChannelHoverCard";

export default function ChannelMentionCard(props: MentionCardProps) {
  return (
    <Show when={props.kind === "channel"}>
      <ChannelHoverCard
        anchor={props.anchor}
        channelId={props.id}
        hoverIntent={props.hoverIntent}
      />
    </Show>
  );
}
