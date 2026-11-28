import { defineQuery } from "@slock/plugins/query/client/api";
import type { Usergroup, UsergroupDetails } from "@slock/types";
import { createStore } from "solid-js";
import { fetchUsergroup, fetchUsergroupDetails } from "./requests";

const MISSING_TTL_MS = 30_000;

const maxAgeMs = (data: object | null) =>
  data === null ? MISSING_TTL_MS : Number.POSITIVE_INFINITY;

const usergroups = defineQuery<string, Usergroup | null>({
  gcMs: Number.POSITIVE_INFINITY,
  load: fetchUsergroup,
  maxAgeMs,
  name: "usergroups",
});

const usergroupDetails = defineQuery<string, UsergroupDetails | null>({
  load: async (id, context) => {
    const details = await fetchUsergroupDetails(id, context);
    if (details) {
      usergroups.set(id, { id: details.id, name: `@${details.handle || details.title}` });
    }
    return details;
  },
  maxAgeMs,
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
    return usergroupDetails.refresh(id);
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
    usergroupDetailsState: usergroupDetails.entry,
  };
}
