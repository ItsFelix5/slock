import type { ChannelSection, Usergroup, UsergroupDetails } from "@slock/slack-api";
import {
  fetchUsergroup,
  fetchUsergroupChannelSection,
  fetchUsergroupDetails,
} from "@slock/slack-api";
import { createEffect, createMemo } from "solid-js";
import { createStore } from "solid-js/store";

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
  const [usergroupSections, setUsergroupSections] = createStore<
    Record<string, ChannelSection | null>
  >({});
  const pendingUsergroupDetails = new Set<string>();
  const pendingUsergroupSections = new Set<string>();

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
      setUsergroupSections(
        id,
        details.isSection
          ? {
              channelIds: details.channelIds,
              id: details.id,
              name: details.title,
              sidebar: "hid",
              type: "usergroup",
            }
          : null,
      );
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

  createEffect(() => {
    for (const id of deps.selfUsergroupIds()) {
      if (id in usergroupSections || pendingUsergroupSections.has(id)) continue;
      pendingUsergroupSections.add(id);
      fetchUsergroupChannelSection(id)
        .then((section) => setUsergroupSections(id, section))
        .catch(() => {})
        .finally(() => pendingUsergroupSections.delete(id));
    }
  });

  const channelSections = createMemo(() =>
    deps
      .selfUsergroupIds()
      .map((id) => usergroupSections[id])
      .filter((section): section is ChannelSection => !!section),
  );

  return {
    channelSections,
    ensureUsergroupDetails,
    isSelfMember,
    refreshUsergroupDetails,
    usergroupById,
    usergroupDetailsById,
  };
}
