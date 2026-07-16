import type { Usergroup } from "@slock/slack-api";
import { fetchUsergroup } from "@slock/slack-api";
import { createStore } from "solid-js/store";

export function createUsergroupsSlice() {
  const [usergroups, setUsergroups] = createStore<Record<string, Usergroup>>({});
  const pendingUsergroups = new Set<string>();

  function usergroupById(id: string): Usergroup | undefined {
    if (!(usergroups[id] || pendingUsergroups.has(id))) {
      pendingUsergroups.add(id);
      fetchUsergroup(id)
        .then((usergroup) => {
          if (usergroup) setUsergroups(id, usergroup);
        })
        .catch(() => {
          // Keep the ID fallback on a transient API failure.
        })
        .finally(() => {
          pendingUsergroups.delete(id);
        });
    }
    return usergroups[id];
  }

  return { usergroupById };
}
