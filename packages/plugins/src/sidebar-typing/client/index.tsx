import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { TypingIndicator } from "@slock/ui";
import { Show } from "solid-js";
import type { HomeRowEndProps } from "../../home/client/api";

const typingStore = service("typing");

function RowTyping(props: HomeRowEndProps) {
  const names = () => typingStore.typingUsersInChannel(props.id).map((user) => user.name);
  return (
    <Show when={names().length}>
      <TypingIndicator dotsOnly inline names={names()} />
    </Show>
  );
}

const setup: Setup = (ctx) => {
  ctx.add("home.rowEnd", RowTyping);
};

export default setup;
