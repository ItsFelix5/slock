import type { Setup } from "@slock/core";
import { DebugInfoDialog } from "@slock/ui";
import { lazy } from "solid-js";
import CanvasDebugButton from "./views/canvas/CanvasDebugButton";
import {
  ActivityDebugItem,
  ChannelDebugItem,
  MessageDebugItem,
  ProfileDebugButton,
} from "./views/debugItems";

const IconsTab = lazy(() => import("./views/IconsTab"));
const BlockKitTab = lazy(() => import("./views/BlockKitTab"));

const setup: Setup = (ctx) => {
  ctx.add("shell.overlay", DebugInfoDialog);
  ctx.add("canvas.headerAction", CanvasDebugButton, { order: 90 });
  ctx.add("profile.meta", ProfileDebugButton, { order: 90 });
  ctx.add("messages.menu", MessageDebugItem, { order: 70 });
  ctx.add("messages.channelMenu", ChannelDebugItem, { order: 70 });
  ctx.add("activity.menu", ActivityDebugItem, { order: 70 });
  ctx.add("settings.tab", { id: "icons", label: "Icons", view: IconsTab }, { order: 90 });
  ctx.add("settings.tab", { id: "blockkit", label: "Block Kit", view: BlockKitTab }, { order: 91 });
};

export default setup;
