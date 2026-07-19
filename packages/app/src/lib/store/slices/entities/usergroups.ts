import type { User, Usergroup, UsergroupDetails } from "@slock/slack-api";
import { fetchUsergroup, fetchUsergroupDetails } from "@slock/slack-api";
import { createStore } from "solid-js/store";

export function createUsergroupsSlice(deps: { currentUser: () => User | undefined }) {
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

  const [usergroupDetails, setUsergroupDetails] = createStore<Record<string, UsergroupDetails>>({});
  const pendingUsergroupDetails = new Set<string>();

  function usergroupDetailsById(id: string): UsergroupDetails | undefined {
    return usergroupDetails[id];
  }

  // Always hits the network (usergroups.list has no per-id lookup — see
  // fetchUsergroupDetails), so callers that just want a hover preview should
  // go through ensureUsergroupDetails instead; this is for the details panel,
  // which wants fresh data on open and after every edit.
  async function refreshUsergroupDetails(id: string): Promise<UsergroupDetails | null> {
    const details = await fetchUsergroupDetails(id);
    if (details) {
      setUsergroupDetails(id, details);
      setUsergroups(id, { id: details.id, name: `@${details.handle || details.title}` });
    }
    return details;
  }

  // Lazy, fetch-once-per-id lookup for hover cards — every usergroup mention
  // rendered anywhere shares this, so it shouldn't refire on every hover.
  function ensureUsergroupDetails(id: string): void {
    if (usergroupDetails[id] || pendingUsergroupDetails.has(id)) return;
    pendingUsergroupDetails.add(id);
    refreshUsergroupDetails(id)
      .catch(() => {})
      .finally(() => pendingUsergroupDetails.delete(id));
  }

  // Lazily fetches membership (piggybacking on ensureUsergroupDetails' cache)
  // so a @usergroup mention can render with the "pings you" highlight once
  // we know the viewer is in it.
  function isSelfMember(id: string): boolean {
    ensureUsergroupDetails(id);
    const me = deps.currentUser();
    return !!me && (usergroupDetails[id]?.memberIds.includes(me.id) ?? false);
  }

  return {
    ensureUsergroupDetails,
    isSelfMember,
    refreshUsergroupDetails,
    usergroupById,
    usergroupDetailsById,
  };
}
