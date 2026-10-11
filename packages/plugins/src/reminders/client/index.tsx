import type { Setup } from "@slock/core";
import { liveOnly } from "../../messages/client/api/deletedMessages";
import RemindMenu from "./views/RemindMenu";

const setup: Setup = (ctx) => {
  ctx.add("messages.menu", liveOnly(RemindMenu), { order: 40 });
};

export default setup;
