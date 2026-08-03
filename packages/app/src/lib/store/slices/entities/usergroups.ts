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
  const [usergroupSections, setUsergroupSections] = createStore<
    Record<string, ChannelSection | null>
  >({});
  const pendingUsergroupDetails = new Set<string>();
  const pendingUsergroupSections = new Set<string>();

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

  // Lazy, fetch-once-per-id lookup for hover cards — every usergroup mention
  // rendered anywhere shares this, so it shouldn't refire on every hover.
  function ensureUsergroupDetails(id: string): void {
    if (usergroupDetails[id] || pendingUsergroupDetails.has(id)) return;
    pendingUsergroupDetails.add(id);
    refreshUsergroupDetails(id)
      .catch(() => {})
      .finally(() => pendingUsergroupDetails.delete(id));
  }

  // client.userBoot's subteams.self already lists every group the viewer
  // belongs to, so a @usergroup mention can get the "pings you" highlight
  // without a network round trip per group.
  function isSelfMember(id: string): boolean {
    return deps.selfUsergroupIds().includes(id);
  }

  // Enabled group sections are separate from users.channelSections. Load the
  // current user's groups directly and merge these into the Home sidebar.
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
