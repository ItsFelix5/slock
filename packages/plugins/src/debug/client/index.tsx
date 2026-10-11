import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { DebugInfoDialog, MenuItem, showDebugInfo } from "@slock/ui";
import { lazy } from "solid-js";
import type { ActivityMenuProps } from "../../activity/client/api";
import type { ChannelMenuProps, MessageMenuProps } from "../../messages/client/api";

const IconsTab = lazy(() => import("./views/IconsTab"));

function DebugItem(props: { close(): void; title: string; data: unknown }) {
  return (
    <MenuItem
      icon="bug"
      onClick={() => {
        props.close();
        showDebugInfo(props.title, props.data);
      }}
    >
      Show debug info
    </MenuItem>
  );
}

function MessageDebugItem(props: MessageMenuProps) {
  return <DebugItem close={props.close} data={props.msg} title={`Message ${props.msg.ts}`} />;
}

function ActivityDebugItem(props: ActivityMenuProps) {
  return (
    <DebugItem
      close={props.close}
      data={props.row.items}
      title={`Activity row: ${props.row.key}`}
    />
  );
}

function ChannelDebugItem(props: ChannelMenuProps) {
  const channels = service("channels");
  const dms = service("dms");
  return (
    <DebugItem
      close={props.close}
      data={props.isDm ? dms.dmById(props.channelId) : channels.channelById(props.channelId)}
      title={`${props.isDm ? "DM" : "Channel"} ${props.channelId}`}
    />
  );
}

const setup: Setup = (ctx) => {
  ctx.add("shell.overlay", DebugInfoDialog);
  ctx.add("messages.menu", MessageDebugItem, { order: 70 });
  ctx.add("messages.channelMenu", ChannelDebugItem, { order: 70 });
  ctx.add("activity.menu", ActivityDebugItem, { order: 70 });
  ctx.add("settings.tab", { id: "icons", label: "Icons", view: IconsTab }, { order: 90 });
};

export default setup;
