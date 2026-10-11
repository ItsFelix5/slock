import { Show } from "solid-js";
import type { MentionCardProps } from "../../../composer/client/api";
import UsergroupHoverCard from "./UsergroupHoverCard";

export default function UsergroupMentionCard(props: MentionCardProps) {
  return (
    <Show when={props.kind === "usergroup"}>
      <UsergroupHoverCard
        anchor={props.anchor}
        hoverIntent={props.hoverIntent}
        usergroupId={props.id}
      />
    </Show>
  );
}
