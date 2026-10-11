import { Slot } from "@slock/core/solid";
import type { useHoverIntent } from "@slock/ui";
import { Show } from "solid-js";
import type { MentionHoverState } from "./mentionHover";

export default function MentionHoverCard(props: {
  state: () => MentionHoverState | undefined;
  hoverIntent: ReturnType<typeof useHoverIntent>;
}) {
  return (
    <Show when={props.state()}>
      {(state) => (
        <Slot
          anchor={() => state().anchorEl}
          hoverIntent={props.hoverIntent}
          id={state().id}
          kind={state().kind}
          point="composer.mentionCard"
        />
      )}
    </Show>
  );
}
