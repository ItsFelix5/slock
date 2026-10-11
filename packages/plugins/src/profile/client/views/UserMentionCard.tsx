import { Show } from "solid-js";
import type { MentionCardProps } from "../../../composer/client/api";
import UserHoverCard from "./UserHoverCard";

export default function UserMentionCard(props: MentionCardProps) {
  return (
    <Show when={props.kind === "user" || props.kind === "userlink"}>
      <UserHoverCard anchor={props.anchor} hoverIntent={props.hoverIntent} userId={props.id} />
    </Show>
  );
}
