import { service } from "@slock/core/solid";
import type { Usergroup, UsergroupDetails } from "@slock/types";
import { queryOptions } from "@tanstack/solid-query";
import { createReactiveQueryCache, defineKey } from "../../query/client/api";
import { fetchUsergroup, fetchUsergroupDetails } from "../../slack/client/api";

const usergroupsKey = defineKey<[string]>("usergroups");
const usergroupDetailsKey = defineKey<[string]>("usergroupDetails");

const query = service("query");

export function usergroupQueryOptions(id: string) {
  return queryOptions({ queryKey: usergroupsKey(id), queryFn: () => fetchUsergroup(id) });
}

function usergroupDetailsQueryOptions(id: string) {
  return queryOptions({
    queryKey: usergroupDetailsKey(id),
    queryFn: async () => {
      const details = await fetchUsergroupDetails(id);
      if (details) {
        query.client.setQueryData<Usergroup>(usergroupQueryOptions(id).queryKey, {
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
  const usergroups = createReactiveQueryCache(query.client, "usergroups", usergroupQueryOptions);
  const usergroupDetails = createReactiveQueryCache(
    query.client,
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

  function refreshUsergroupDetails(id: string) {
    return query.client.query(usergroupDetailsQueryOptions(id));
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
    usergroupById,
    usergroupDetailsById,
  };
}
