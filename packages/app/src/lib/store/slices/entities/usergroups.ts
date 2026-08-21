import { createStore } from "solid-js/store";
import type { Usergroup, UsergroupDetails } from "../../../api";
import { fetchUsergroup, fetchUsergroupDetails } from "../../../api";

export function createUsergroupsSlice(deps: { selfUsergroupIds: () => string[] }) {
  const [usergroups, setUsergroups] = createStore<Record<string, Usergroup>>({});
  const pendingUsergroups = new Set<string>();

  function usergroupById(id: string): Usergroup | undefined {
    if (!(usergroups[id] || pendingUsergroups.has(id))) {
      pendingUsergroups.add(id);
      fetchUsergroup(id)
        .then((usergroup) => {
          if (usergroup) setUsergroups(id, usergroup);
        })
        .catch(() => {})
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

  async function refreshUsergroupDetails(id: string): Promise<UsergroupDetails | null> {
    const details = await fetchUsergroupDetails(id);
    if (details) {
      setUsergroupDetails(id, details);
      setUsergroups(id, {
        id: details.id,
        name: `@${details.handle || details.title}`,
      });
    }
    return details;
  }

  function ensureUsergroupDetails(id: string): void {
    if (usergroupDetails[id] || pendingUsergroupDetails.has(id)) return;
    pendingUsergroupDetails.add(id);
    refreshUsergroupDetails(id)
      .catch(() => {})
      .finally(() => pendingUsergroupDetails.delete(id));
  }

  function isSelfMember(id: string): boolean {
    return deps.selfUsergroupIds().includes(id);
  }

  return {
    ensureUsergroupDetails,
    isSelfMember,
    refreshUsergroupDetails,
    usergroupById,
    usergroupDetailsById,
  };
}
