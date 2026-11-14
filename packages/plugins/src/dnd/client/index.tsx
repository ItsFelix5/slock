import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { defineKey } from "../../query/client/api";
import { gatewayHandler } from "../../realtime/client/api";
import { USER_DND_QUERY } from "./fetch";
import UserDnd from "./UserDnd";
import DndButton from "./views/DndButton";

const userDndKey = defineKey<[string]>(USER_DND_QUERY);

const setup: Setup = (ctx) => {
  const { client } = service("query");
  ctx.add("sidebar.toolbar", DndButton, { order: 10 });
  ctx.add("profile.meta", UserDnd, { order: 20 });
  ctx.add(
    "realtime.handler",
    gatewayHandler(["dnd_updated_user", "dnd_invalidated"], (event) => {
      if (event.user) void client.invalidateQueries({ queryKey: userDndKey(event.user) });
    }),
  );
};

export default setup;
