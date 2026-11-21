import type { Setup } from "@slock/core";
import { lazyChunk } from "@slock/core/solid";
import { Show } from "solid-js";

import HeaderMembersButton from "./views/HeaderMembersButton";

const MembersTab = lazyChunk(() => import("./views/MembersTab"));

const setup: Setup = (ctx) => {
  ctx.add("messages.header", HeaderMembersButton, { order: 20 });
  ctx.add(
    "channel-details.tab",
    {
      count: (details) => details.memberCount,
      id: "members",
      label: "Members",
      view: (props) => (
        <Show keyed when={props.channelId}>
          {(channelId) => (
            <MembersTab
              channelId={channelId}
              channelName={props.channelName}
              memberCount={props.memberCount}
              onMembersChanged={props.refetch}
            />
          )}
        </Show>
      ),
    },
    { order: 10 },
  );
};

export default setup;
