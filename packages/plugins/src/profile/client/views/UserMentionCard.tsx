import type { MentionCardProps } from "@slock/plugins/composer/client/api";
import { Show } from "solid-js";
import UserHoverCard from "./UserHoverCard";

export default function UserMentionCard(props: MentionCardProps) {
  return (
    <Show when={props.kind === "user" || props.kind === "userlink" ? props.id : undefined}>
      {(userId) => (
        <UserHoverCard anchor={props.anchor} hoverIntent={props.hoverIntent} userId={userId()} />
      )}
    </Show>
  );
}
