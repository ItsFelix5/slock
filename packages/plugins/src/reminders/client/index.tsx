import type { Setup } from "@slock/core";
import { liveOnly } from "@slock/plugins/messages/client/api/deletedMessages";
import { ActivityRemindItem, MessageRemindItem } from "./views/remindItems";

const setup: Setup = (ctx) => {
  ctx.add("messages.menu", liveOnly(MessageRemindItem), { order: 40 });
  ctx.add("activity.menu", ActivityRemindItem, { order: 40 });
};

export default setup;
