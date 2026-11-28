import type { Setup } from "@slock/core";
import { lazyChunk } from "@slock/core/solid";
import { gatewayHandler } from "@slock/plugins/realtime/client/api";
import { parseChannelId } from "@slock/slack";
import { Show } from "solid-js";
import { postingPrefs } from "./store";

const SettingsTab = lazyChunk(() => import("./views/SettingsTab"));
const GroupSettingsTab = lazyChunk(() => import("./views/GroupSettingsTab"));

const setup: Setup = (ctx) => {
  ctx.add(
    "realtime.handler",
    gatewayHandler(["channel_updated"], (event) => {
      if (!event.updates.postingChanged) return;
      for (const id of event.channels) postingPrefs.invalidate(parseChannelId(id));
    }),
  );
  ctx.add(
    "channel-details.tab",
    {
      id: "settings",
      label: "Settings",
      audience: "channelManagers",
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
  ctx.add(
    "channel-details.tab",
    {
      audience: "groupChat",
      id: "group-settings",
      label: "Settings",
      view: (props) => (
        <Show keyed when={props.channelId}>
          {(channelId) => <GroupSettingsTab channelId={channelId} onChanged={props.refetch} />}
        </Show>
      ),
    },
    { order: 20 },
  );
};

export default setup;
