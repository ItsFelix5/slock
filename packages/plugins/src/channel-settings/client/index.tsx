import type { Setup } from "@slock/core";
import { lazyChunk } from "@slock/core/solid";
import { Show } from "solid-js";

const SettingsTab = lazyChunk(() => import("./views/SettingsTab"));

const setup: Setup = (ctx) => {
  ctx.add(
    "channel-details.tab",
    {
      id: "settings",
      label: "Settings",
      managerOnly: true,
      view: (props) => (
        <Show keyed when={props.channelId}>
          {(channelId) => (
            <SettingsTab
              archived={props.archived}
              channelId={channelId}
              onChanged={props.refetch}
              private={props.private}
            />
          )}
        </Show>
      ),
    },
    { order: 20 },
  );
};

export default setup;
