import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { createUsergroupsSlice } from "./store";

const setup: Setup = (ctx) => {
  const { bootstrap } = service("bootstrap");
  const store = createUsergroupsSlice({
    allUsergroupIds: () => bootstrap.data?.allUsergroupIds ?? [],
    selfUsergroupIds: () => bootstrap.data?.selfUsergroupIds ?? [],
  });
  ctx.provide("usergroups", store);
  ctx.add("realtime.handler", {
    run: (event) => {
      if (
        event.type === "subteam_created" ||
        event.type === "subteam_updated" ||
        event.type === "subteam_deleted"
      ) {
        if (event.subteam.id) store.invalidateUsergroup(event.subteam.id);
      } else if (event.type === "subteam_members_changed" && event.subteam_id) {
        store.invalidateUsergroup(event.subteam_id);
      }
    },
    types: ["subteam_created", "subteam_updated", "subteam_deleted", "subteam_members_changed"],
  });
  ctx.add("messages.blockKit", {
    resolveUsergroup: (id) => {
      const usergroup = store.usergroupById(id);
      return usergroup ? { isSelf: store.isSelfMember(id), name: usergroup.name } : undefined;
    },
  });
};

export default setup;
