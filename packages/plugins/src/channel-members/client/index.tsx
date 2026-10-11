import type { Setup } from "@slock/core";
import { lazy } from "solid-js";

import HeaderMembersButton from "./views/HeaderMembersButton";

const MembersTab = lazy(() => import("./views/MembersTab"));

const setup: Setup = (ctx) => {
  ctx.add("messages.header", HeaderMembersButton, { order: 20 });
  ctx.add(
    "channel-details.tab",
    {
      count: (details) => details.memberCount,
      id: "members",
      label: "Members",
      view: (props) => (
        <MembersTab
          channelId={props.channelId}
          channelName={props.channelName}
          memberCount={props.memberCount}
          onMembersChanged={props.refetch}
        />
      ),
    },
    { order: 10 },
  );
};

export default setup;
