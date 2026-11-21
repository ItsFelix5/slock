import type { Setup } from "@slock/core";
import { isUserId } from "@slock/slack";
import { gatewayHandler } from "../../realtime/client/api";
import { userDnd } from "./queries";
import UserDnd from "./UserDnd";
import DndButton from "./views/DndButton";

const setup: Setup = (ctx) => {
  ctx.add("sidebar.toolbar", DndButton, { order: 10 });
  ctx.add("profile.meta", UserDnd, { order: 20 });
  ctx.add(
    "realtime.handler",
    gatewayHandler(["dnd_updated_user", "dnd_invalidated"], (event) => {
      if (event.user && isUserId(event.user)) userDnd.invalidate(event.user);
    }),
  );
};

export default setup;
