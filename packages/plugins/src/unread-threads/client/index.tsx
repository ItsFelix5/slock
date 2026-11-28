import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { For } from "solid-js";
import ThreadRow from "./ThreadRow";
import { unreadThreadTarget } from "./threadTarget";

const setup: Setup = (ctx) => {
  const activity = service("activity");
  ctx.add("home.channelRows", {
    active: (channelId) => activity.unreadThreads(channelId).length > 0,
    cycleTargets: (channelId) => activity.unreadThreads(channelId).map(unreadThreadTarget),
    view: (props) => (
      <div class="sidebar-thread-list">
        <For each={activity.unreadThreads(props.channelId)}>
          {(item) => <ThreadRow item={item} />}
        </For>
      </div>
    ),
  });
};

export default setup;
