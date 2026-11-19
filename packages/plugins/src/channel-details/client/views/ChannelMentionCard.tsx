import { isChannelId } from "@slock/slack";
import { Show } from "solid-js";
import type { MentionCardProps } from "../../../composer/client/api";
import ChannelHoverCard from "./ChannelHoverCard";

export default function ChannelMentionCard(props: MentionCardProps) {
  return (
    <Show when={props.kind === "channel" && isChannelId(props.id) ? props.id : undefined}>
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
