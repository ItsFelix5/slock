import type { MentionCardProps } from "@slock/plugins/composer/client/api";
import { Show } from "solid-js";
import UsergroupHoverCard from "./UsergroupHoverCard";

export default function UsergroupMentionCard(props: MentionCardProps) {
  return (
    <Show when={props.kind === "usergroup" ? props.id : undefined}>
      {(usergroupId) => (
        <UsergroupHoverCard
          anchor={props.anchor}
          hoverIntent={props.hoverIntent}
          usergroupId={usergroupId()}
        />
      )}
    </Show>
  );
}
