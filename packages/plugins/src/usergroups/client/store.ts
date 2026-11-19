import type { Usergroup, UsergroupDetails } from "@slock/types";
import { createStore } from "solid-js";
import { defineQuery } from "../../query/client/api";
import { fetchUsergroup, fetchUsergroupDetails } from "../../slack/client/api";

const usergroups = defineQuery<string, Usergroup | null>({
  load: fetchUsergroup,
  name: "usergroups",
});

const usergroupDetails = defineQuery<string, UsergroupDetails | null>({
  load: async (id) => {
    const details = await fetchUsergroupDetails(id);
    if (details) {
      usergroups.set(id, { id: details.id, name: `@${details.handle || details.title}` });
    }
    return details;
  },
  name: "usergroupDetails",
});

export function createUsergroupsSlice(deps: {
  allUsergroupIds: () => string[];
  selfUsergroupIds: () => string[];
}) {
  function usergroupById(id: string): Usergroup | undefined {
    return usergroups.peek(id) ?? undefined;
  }

  function usergroupDetailsById(id: string): UsergroupDetails | undefined {
    return usergroupDetails.peek(id) ?? undefined;
  }

  function ensureUsergroupDetails(id: string): void {
    void usergroupDetails.ensure(id).catch(() => {});
  }

  const [selfMembership, setSelfMembershipFlags] = createStore<Record<string, boolean>>({});

  function setSelfMembership(id: string, member: boolean): void {
    setSelfMembershipFlags((draft) => {
      draft[id] = member;
    });
  }

  function isSelfMember(id: string): boolean {
    return selfMembership[id] ?? deps.selfUsergroupIds().includes(id);
  }

  function mentionableUsergroups(): Usergroup[] {
    return deps
      .allUsergroupIds()
      .map((id) => usergroupById(id))
      .filter((g): g is Usergroup => !!g);
  }

  function refreshUsergroupDetails(id: string) {
    return usergroupDetails.ensure(id, { maxAgeMs: 0 });
  }

  function invalidateUsergroup(id: string): void {
    usergroups.invalidate(id);
    usergroupDetails.invalidate(id);
  }

  return {
    ensureUsergroupDetails,
    invalidateUsergroup,
    isSelfMember,
    mentionableUsergroups,
    refreshUsergroupDetails,
    setSelfMembership,
    usergroupById,
    usergroupDetailsById,
  };
}
