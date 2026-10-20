import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { For } from "solid-js";
import ThreadRow from "./ThreadRow";

const setup: Setup = (ctx) => {
  const activity = service("activity");
  ctx.add("home.channelRows", {
    active: (channelId) => activity.unreadThreads(channelId).length > 0,
    view: (props) => (
      <For each={activity.unreadThreads(props.channelId)}>
        {(item) => <ThreadRow item={item} />}
      </For>
    ),
  });
};

export default setup;
