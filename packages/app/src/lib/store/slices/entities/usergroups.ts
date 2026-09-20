import { queryOptions } from "@tanstack/solid-query";
import type { Usergroup, UsergroupDetails } from "../../../api";
import { fetchUsergroup, fetchUsergroupDetails } from "../../../api";
import { queryClient } from "../../../queryClient";
import { createReactiveQueryCache } from "../../../reactiveQueryCache";

export function usergroupQueryOptions(id: string) {
  return queryOptions({ queryKey: ["usergroups", id], queryFn: () => fetchUsergroup(id) });
}

export function usergroupDetailsQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["usergroupDetails", id],
    queryFn: async () => {
      const details = await fetchUsergroupDetails(id);
      if (details) {
        queryClient.setQueryData<Usergroup>(usergroupQueryOptions(id).queryKey, {
          id: details.id,
          name: `@${details.handle || details.title}`,
        });
      }
      return details;
    },
  });
}

export function createUsergroupsSlice(deps: {
  allUsergroupIds: () => string[];
  selfUsergroupIds: () => string[];
}) {
  const usergroups = createReactiveQueryCache<Usergroup | null>(
    queryClient,
    "usergroups",
    usergroupQueryOptions,
  );
  const usergroupDetails = createReactiveQueryCache<UsergroupDetails | null>(
    queryClient,
    "usergroupDetails",
    usergroupDetailsQueryOptions,
  );

  function usergroupById(id: string): Usergroup | undefined {
    return usergroups.entry(id) ?? undefined;
  }

  function usergroupDetailsById(id: string): UsergroupDetails | undefined {
    return usergroupDetails.entry(id) ?? undefined;
  }

  function ensureUsergroupDetails(id: string): void {
    usergroupDetails.ensure(id);
  }

  function isSelfMember(id: string): boolean {
    return deps.selfUsergroupIds().includes(id);
  }

  function mentionableUsergroups(): Usergroup[] {
    return deps
      .allUsergroupIds()
      .map((id) => usergroupById(id))
      .filter((g): g is Usergroup => !!g);
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
    usergroupById,
    usergroupDetailsById,
  };
}
