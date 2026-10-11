import type { Setup } from "@slock/core";
import { liveOnly } from "../../messages/client/api/deletedMessages";
import ShortcutsMenu from "./views/ShortcutsMenu";

const setup: Setup = (ctx) => {
  ctx.add("messages.menu", liveOnly(ShortcutsMenu), { order: 80 });
};

export default setup;
