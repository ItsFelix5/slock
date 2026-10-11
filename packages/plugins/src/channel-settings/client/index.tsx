import type { Setup } from "@slock/core";
import { lazy } from "solid-js";

const SettingsTab = lazy(() => import("./views/SettingsTab"));

const setup: Setup = (ctx) => {
  ctx.add(
    "channel-details.tab",
    {
      id: "settings",
      label: "Settings",
      managerOnly: true,
      view: (props) => (
        <SettingsTab
          archived={props.archived}
          channelId={props.channelId}
          onChanged={props.refetch}
          private={props.private}
        />
      ),
    },
    { order: 20 },
  );
};

export default setup;
