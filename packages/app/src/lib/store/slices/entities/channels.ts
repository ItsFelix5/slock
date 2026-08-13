import type { BrowsableChannel, Channel, ChannelSection, UserPrefs } from "@slock/slack-api";
import {
  createSection as apiCreateSection,
  deleteSection as apiDeleteSection,
  renameSection as apiRenameSection,
  reorderSection as apiReorderSection,
  setChannelSectionsPreference as apiSetChannelSectionsPreference,
  setUsergroupSectionOrderPreference as apiSetUsergroupSectionOrderPreference,
  updateSectionChannels as apiUpdateSectionChannels,
  fetchBrowsableChannels,
  fetchChannel,
  fetchChannelMembers,
  fetchFreshSections,
  fetchSections,
  joinChannel,
  leaveChannel,
  setUsergroupSectionSidebarPreferences,
  toggleStar,
} from "@slock/slack-api";
import { createEffect, createMemo, createResource, createSignal, type Setter } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { actionFeedback } from "../feedback";
import type { Nav, View } from "../types";
import type { ChannelPlacementOutcome } from "./mutations/channelPlacementOutcome";
import { applySectionOrder, reorderSections } from "./mutations/sectionOrder";
import {
  setSectionSidebarPreference,
  setUsergroupSectionOrderPreference,
  setUsergroupSectionSidebarPreference,
} from "./mutations/sectionSidebarPrefs";

export function createChannelsSlice(deps: {
  bootstrap: () => { channels: Channel[]; starredChannelIds: string[] } | undefined;
  activeView: () => View | null;
  nav: () => Nav;
  setActiveView: (view: View) => void;
  usergroupSections: () => ChannelSection[];
  userPrefs: () => UserPrefs | undefined;
  mutateUserPrefs: Setter<UserPrefs | undefined>;
}) {
  const [extraChannels, setExtraChannels] = createStore<Channel[]>([]);

  const [discoveredChannels, setDiscoveredChannels] = createStore<Channel[]>([]);
  const pendingChannels = new Set<string>();
  const channelDiscoveryMisses = new Map<string, number>();
  const channelDiscoveryRetryMs = 30_000;
  const channelDetailsRequested = new Set<string>();

  const [channelPatches, setChannelPatches] = createStore<Record<string, Partial<Channel>>>({});
  const [leftChannelIds, setLeftChannelIds] = createStore<Record<string, boolean>>({});
  const [joinPendingIds, setJoinPendingIds] = createStore<Record<string, boolean>>({});
  const [leavePendingIds, setLeavePendingIds] = createStore<Record<string, boolean>>({});
  const [starredChannelIds, setStarredChannelIds] = createStore<Record<string, boolean>>({});
  const [placementPendingByChannel, setPlacementPendingByChannel] = createStore<
    Record<string, boolean>
  >({});
  let starredSeeded = false;
  const [browsableChannels, setBrowsableChannels] = createSignal<BrowsableChannel[]>([]);

  createEffect(() => {
    const data = deps.bootstrap();
    if (!data || starredSeeded) return;
    starredSeeded = true;
    for (const id of data.starredChannelIds) setStarredChannelIds(id, true);
  });

  const channels = createMemo<Channel[]>(() => {
    const base = deps.bootstrap()?.channels ?? [];
    const extra = extraChannels.filter((c) => !base.some((b) => b.id === c.id));
    return [...base, ...extra].map((c) =>
      channelPatches[c.id] ? { ...c, ...channelPatches[c.id] } : c,
    );
  });

  function patchChannel(id: string, patch: Partial<Channel>) {
    setChannelPatches(id, { ...channelPatches[id], ...patch });
  }

  async function discoverChannel(id: string): Promise<boolean> {
    const channel = await fetchChannel(id);
    if (!channel) return false;
    setDiscoveredChannels(produce((list) => list.push(channel)));
    return true;
  }

  function channelById(id: string): Channel | undefined {
    const known =
      channels().find((c) => c.id === id) ?? discoveredChannels.find((c) => c.id === id);
    if (known) return known;

    if (!deps.bootstrap()) return;
    const missedAt = channelDiscoveryMisses.get(id);
    if (missedAt && Date.now() - missedAt < channelDiscoveryRetryMs) return;
    if (!pendingChannels.has(id)) {
      pendingChannels.add(id);
      discoverChannel(id)
        .then((found) => {
          if (found) channelDiscoveryMisses.delete(id);
          else channelDiscoveryMisses.set(id, Date.now());
        })
        .catch(() => channelDiscoveryMisses.set(id, Date.now()))
        .finally(() => pendingChannels.delete(id));
    }
  }

  function ensureChannelTopic(id: string): void {
    const known = channels().find((c) => c.id === id);
    if (
      !known ||
      (known.topic && known.memberCount !== undefined) ||
      channelDetailsRequested.has(id)
    )
      return;
    channelDetailsRequested.add(id);
    fetchChannel(id)
      .then((channel) => {
        if (!channel) return;
        patchChannel(id, {
          memberCount: channel.memberCount,
          name: channel.name,
          private: channel.private,
          topic: channel.topic,
        });
      })
      .catch(() => channelDetailsRequested.delete(id));
  }

  function isChannelMember(id: string): boolean {
    return channels().some((c) => c.id === id);
  }

  const channelRosters = new Map<string, Set<string>>();
  const rosterLoads = new Map<string, Promise<Set<string> | undefined>>();

  function channelMemberIds(channelId: string): Set<string> | undefined {
    return channelRosters.get(channelId);
  }

  function ensureChannelRoster(channelId: string): Promise<Set<string> | undefined> {
    const cached = channelRosters.get(channelId);
    if (cached) return Promise.resolve(cached);
    const inFlight = rosterLoads.get(channelId);
    if (inFlight) return inFlight;
    const load = (async () => {
      try {
        const ids = new Set<string>();
        let cursor: string | undefined;
        do {
          const page = await fetchChannelMembers(channelId, "everyone", cursor);
          for (const member of page.members) ids.add(member.id);
          cursor = page.nextCursor;
        } while (cursor);
        channelRosters.set(channelId, ids);
        return ids;
      } catch (err) {
        console.error("Failed to load channel roster", err);
      } finally {
        rosterLoads.delete(channelId);
      }
    })();
    rosterLoads.set(channelId, load);
    return load;
  }

  function isChannelLeft(channelId: string): boolean {
    return !!leftChannelIds[channelId];
  }

  function isJoinPending(channelId: string): boolean {
    return !!joinPendingIds[channelId];
  }

  function isLeavePending(channelId: string): boolean {
    return !!leavePendingIds[channelId];
  }

  async function joinChannelById(channelId: string): Promise<boolean> {
    if (isJoinPending(channelId)) return false;
    setJoinPendingIds(channelId, true);
    try {
      const channel = await joinChannel(channelId);
      setExtraChannels(
        produce((list) => {
          if (!list.some((candidate) => candidate.id === channel.id)) list.push(channel);
        }),
      );
      setLeftChannelIds(channelId, false);
      deps.setActiveView({ id: channel.id, kind: "channel" });
      return true;
    } catch (err) {
      console.error("Failed to join channel", err);
      actionFeedback.flash(channelId, "Failed to join channel.", "error");
      return false;
    } finally {
      setJoinPendingIds(channelId, false);
    }
  }

  async function leaveCurrentChannel(channelId: string): Promise<boolean> {
    if (isLeavePending(channelId)) return false;
    setLeavePendingIds(channelId, true);
    try {
      await leaveChannel(channelId);
      setLeftChannelIds(channelId, true);
      if (deps.activeView()?.id === channelId) {
        const next = channels().find((c) => c.id !== channelId && !isChannelLeft(c.id));
        if (next) deps.setActiveView({ id: next.id, kind: "channel" });
      }
      return true;
    } catch (err) {
      console.error("Failed to leave channel", err);
      actionFeedback.flash(channelId, "Failed to leave channel.", "error");
      return false;
    } finally {
      setLeavePendingIds(channelId, false);
    }
  }

  let sectionsLoaded = false;
  const loadSections = () => {
    const load = sectionsLoaded ? fetchFreshSections : fetchSections;
    sectionsLoaded = true;
    return load();
  };
  const [rawSections, { refetch: refetchSections, mutate: mutateSections }] = createResource(
    () => (deps.nav() === "home" ? true : undefined),
    loadSections,
  );
  const [sectionStructurePending, setSectionStructurePending] = createSignal(false);
  const [sectionSidebarPendingById, setSectionSidebarPendingById] = createStore<
    Record<string, boolean>
  >({});
  async function refreshSections(): Promise<ChannelSection[] | null | undefined> {
    try {
      return await refetchSections();
    } catch {}
  }

  const sections = createMemo<ChannelSection[] | undefined>(() => {
    const list = rawSections();
    const groupSections = deps.usergroupSections();
    const prefs = deps.userPrefs();
    const visibleGroupSections = groupSections.map((section) => ({
      ...section,
      sidebar: prefs?.usergroupSectionSidebar[section.id] ?? section.sidebar,
    }));
    const usergroupOrder =
      visibleGroupSections.length > 0 ? (prefs?.usergroupSectionOrder ?? []) : [];
    if (!list)
      return visibleGroupSections.length > 0
        ? applySectionOrder(visibleGroupSections, usergroupOrder)
        : list;
    const sectionSort = prefs?.sectionSort ?? {};
    const sectionSidebar = prefs?.sectionSidebar ?? {};
    const personalSections = list.map((s) => {
      const sort = sectionSort[s.id];
      const sidebar = sectionSidebar[s.id] ?? s.sidebar;
      if (!sort && sidebar === s.sidebar) return s;
      return { ...s, sidebar, ...(sort ? { sort } : {}) };
    });
    const personalIds = new Set(personalSections.map((section) => section.id));
    return applySectionOrder(
      [
        ...personalSections,
        ...visibleGroupSections.filter((section) => !personalIds.has(section.id)),
      ],
      usergroupOrder,
    );
  });

  async function createChannelSection(
    name: string,
    feedbackKey = name,
  ): Promise<{ id: string; name: string } | null> {
    if (sectionStructurePending()) return null;
    setSectionStructurePending(true);
    try {
      const created = await apiCreateSection(name);
      if (!created) {
        actionFeedback.flash(feedbackKey, "Failed to create section.", "error");
        return null;
      }
      await refreshSections();
      return created;
    } catch (err) {
      console.error("Failed to create section", err);
      actionFeedback.flash(feedbackKey, "Failed to create section.", "error");
      return null;
    } finally {
      setSectionStructurePending(false);
    }
  }

  async function renameChannelSection(sectionId: string, name: string): Promise<boolean> {
    if (sectionStructurePending()) return false;
    setSectionStructurePending(true);
    try {
      if (await apiRenameSection(sectionId, name)) {
        await refreshSections();
        return true;
      }
      actionFeedback.flash(sectionId, "Failed to rename section.", "error");
      return false;
    } catch (err) {
      console.error("Failed to rename section", err);
      actionFeedback.flash(sectionId, "Failed to rename section.", "error");
      return false;
    } finally {
      setSectionStructurePending(false);
    }
  }

  async function deleteChannelSection(sectionId: string): Promise<boolean> {
    if (sectionStructurePending()) return false;
    setSectionStructurePending(true);
    try {
      if (await apiDeleteSection(sectionId)) {
        await refreshSections();
        return true;
      }
      actionFeedback.flash(sectionId, "Failed to delete section.", "error");
      return false;
    } catch (err) {
      console.error("Failed to delete section", err);
      actionFeedback.flash(sectionId, "Failed to delete section.", "error");
      return false;
    } finally {
      setSectionStructurePending(false);
    }
  }

  function isSectionSidebarPending(sectionId: string): boolean {
    return !!sectionSidebarPendingById[sectionId];
  }

  async function setChannelSectionSidebar(
    sectionId: string,
    sidebar: ChannelSection["sidebar"],
  ): Promise<boolean> {
    const section = (sections() ?? []).find((candidate) => candidate.id === sectionId);
    if (
      !section ||
      section.sidebar === sidebar ||
      sectionStructurePending() ||
      isSectionSidebarPending(sectionId)
    )
      return false;

    const prev = deps.userPrefs();
    if (!prev) {
      actionFeedback.flash(
        sectionId,
        "Preferences are unavailable. Try loading them again.",
        "error",
      );
      return false;
    }
    const isUsergroupSection = section.type === "usergroup";
    const previousSidebar = isUsergroupSection
      ? prev.usergroupSectionSidebar[sectionId]
      : prev.sectionSidebar[sectionId];
    setSectionSidebarPendingById(sectionId, true);
    actionFeedback.clear(sectionId);
    deps.mutateUserPrefs((current) =>
      current
        ? isUsergroupSection
          ? setUsergroupSectionSidebarPreference(current, sectionId, sidebar)
          : setSectionSidebarPreference(current, sectionId, sidebar)
        : current,
    );
    const rollback = () =>
      deps.mutateUserPrefs((current) =>
        current
          ? isUsergroupSection
            ? setUsergroupSectionSidebarPreference(current, sectionId, previousSidebar)
            : setSectionSidebarPreference(current, sectionId, previousSidebar)
          : current,
      );
    try {
      const ok = isUsergroupSection
        ? await setUsergroupSectionSidebarPreferences({
            ...prev.usergroupSectionSidebar,
            [sectionId]: sidebar,
          })
        : await apiSetChannelSectionsPreference(deps.userPrefs()?.channelSections ?? {});
      if (ok) return true;
      actionFeedback.flash(sectionId, "Failed to update section filter.", "error");
      rollback();
      return false;
    } catch (err) {
      console.error("Failed to update section filter", err);
      actionFeedback.flash(sectionId, "Failed to update section filter.", "error");
      rollback();
      return false;
    } finally {
      setSectionSidebarPendingById(sectionId, false);
    }
  }

  function toggleSectionFilter(sectionId: string) {
    const section = (sections() ?? []).find((candidate) => candidate.id === sectionId);
    if (!section) return;
    void setChannelSectionSidebar(sectionId, section.sidebar === "all" ? "hid" : "all");
  }

  async function reorderChannelSection(
    sectionId: string,
    nextSectionId: string | null,
  ): Promise<boolean> {
    if (sectionStructurePending()) return false;
    const current = sections() ?? [];
    const optimistic = reorderSections(current, sectionId, nextSectionId);
    if (!optimistic) return false;

    if (current.some((section) => section.type === "usergroup")) {
      const previousPrefs = deps.userPrefs();
      if (!previousPrefs) {
        actionFeedback.flash(
          sectionId,
          "Preferences are unavailable. Try loading them again.",
          "error",
        );
        return false;
      }
      const nextOrder = optimistic.map((section) => section.id);
      setSectionStructurePending(true);
      actionFeedback.clear(sectionId);
      deps.mutateUserPrefs((prefs) =>
        prefs ? setUsergroupSectionOrderPreference(prefs, nextOrder) : prefs,
      );
      const rollback = () =>
        deps.mutateUserPrefs((prefs) =>
          prefs
            ? setUsergroupSectionOrderPreference(prefs, previousPrefs.usergroupSectionOrder)
            : prefs,
        );
      try {
        if (await apiSetUsergroupSectionOrderPreference(nextOrder)) return true;
        actionFeedback.flash(sectionId, "Failed to reorder section.", "error");
        rollback();
        return false;
      } catch (err) {
        console.error("Failed to reorder section", err);
        actionFeedback.flash(sectionId, "Failed to reorder section.", "error");
        rollback();
        return false;
      } finally {
        setSectionStructurePending(false);
      }
    }
    setSectionStructurePending(true);
    mutateSections(optimistic);
    try {
      if (await apiReorderSection(sectionId, nextSectionId)) {
        await refreshSections();
        return true;
      }
      actionFeedback.flash(sectionId, "Failed to reorder section.", "error");
      mutateSections(current);
      return false;
    } catch (err) {
      console.error("Failed to reorder section", err);
      actionFeedback.flash(sectionId, "Failed to reorder section.", "error");
      mutateSections(current);
      return false;
    } finally {
      setSectionStructurePending(false);
    }
  }

  function isChannelStarred(channelId: string): boolean {
    return !!starredChannelIds[channelId];
  }

  function isChannelPlacementPending(channelId: string): boolean {
    return !!placementPendingByChannel[channelId];
  }

  async function toggleChannelStar(channelId: string): Promise<ChannelPlacementOutcome> {
    if (isChannelPlacementPending(channelId)) return "failed";
    const currentlyStarred = isChannelStarred(channelId);
    const changesSectionMembership = !currentlyStarred;
    if (changesSectionMembership && sectionStructurePending()) return "failed";
    setPlacementPendingByChannel(channelId, true);
    if (changesSectionMembership) setSectionStructurePending(true);
    setStarredChannelIds(channelId, !currentlyStarred);
    let starUpdated = false;
    try {
      await toggleStar(channelId, currentlyStarred);
      starUpdated = true;
      if (currentlyStarred) return "applied";

      const from = (sections() ?? []).find(
        (section) => section.type === "standard" && section.channelIds.includes(channelId),
      );
      if (
        from &&
        !(await apiUpdateSectionChannels(from.id, {
          removeChannelIds: [channelId],
        }))
      ) {
        actionFeedback.flash(
          channelId,
          "Starred, but couldn't remove the channel from its previous section.",
          "error",
        );
        return "applied-with-warning";
      }
      if (from) await refreshSections();
      return "applied";
    } catch (err) {
      if (starUpdated) {
        console.error("Failed to remove starred channel from its section", err);
        actionFeedback.flash(
          channelId,
          "Starred, but couldn't remove the channel from its previous section.",
          "error",
        );
      } else {
        console.error("Failed to toggle star", err);
        actionFeedback.flash(channelId, "Failed to update star.", "error");
        setStarredChannelIds(channelId, currentlyStarred);
        return "failed";
      }
      return "applied-with-warning";
    } finally {
      setPlacementPendingByChannel(channelId, false);
      if (changesSectionMembership) setSectionStructurePending(false);
    }
  }

  async function moveChannelToSection(
    channelId: string,
    targetSectionId: string | null,
  ): Promise<ChannelPlacementOutcome> {
    if (isChannelPlacementPending(channelId) || sectionStructurePending()) return "failed";
    setPlacementPendingByChannel(channelId, true);
    setSectionStructurePending(true);
    const current = sections() ?? [];
    const from = current.find(
      (s) => s.type === "standard" && s.channelIds.includes(channelId) && s.id !== targetSectionId,
    );
    let removedFromSource = false;
    let insertedIntoTarget = false;
    try {
      if (from) {
        const ok = await apiUpdateSectionChannels(from.id, {
          removeChannelIds: [channelId],
        });
        if (!ok) {
          actionFeedback.flash(channelId, "Failed to move channel.", "error");
          return "failed";
        }
        removedFromSource = true;
      }
      if (targetSectionId) {
        const ok = await apiUpdateSectionChannels(targetSectionId, {
          insertChannelIds: [channelId],
        });
        if (!ok) {
          if (from)
            await apiUpdateSectionChannels(from.id, {
              insertChannelIds: [channelId],
            });
          actionFeedback.flash(channelId, "Failed to move channel.", "error");
          await refreshSections();
          return "failed";
        }
        insertedIntoTarget = true;

        if (isChannelStarred(channelId)) {
          setStarredChannelIds(channelId, false);
          try {
            await toggleStar(channelId, true);
          } catch (err) {
            console.error("Failed to unstar channel", err);
            setStarredChannelIds(channelId, true);
            actionFeedback.flash(
              channelId,
              "Moved, but couldn't remove the channel from Starred.",
              "error",
            );
            await refreshSections();
            return "applied-with-warning";
          }
        }
      }
      await refreshSections();
      return "applied";
    } catch (err) {
      console.error("Failed to move channel", err);
      if (removedFromSource && !insertedIntoTarget && from) {
        try {
          await apiUpdateSectionChannels(from.id, {
            insertChannelIds: [channelId],
          });
        } catch (rollbackError) {
          console.error("Failed to restore channel to its previous section", rollbackError);
        }
      }
      actionFeedback.flash(channelId, "Failed to move channel.", "error");
      await refreshSections();
      return "failed";
    } finally {
      setPlacementPendingByChannel(channelId, false);
      setSectionStructurePending(false);
    }
  }

  async function searchBrowsableChannels(query: string) {
    const found = await fetchBrowsableChannels(query);
    setBrowsableChannels(found);
  }

  return {
    browsableChannels,
    channelById,
    channelMemberIds,
    channels,
    createChannelSection,
    deleteChannelSection,
    ensureChannelRoster,
    ensureChannelTopic,
    isChannelLeft,
    isChannelMember,
    isChannelPlacementPending,
    isChannelStarred,
    isJoinPending,
    isLeavePending,
    isSectionSidebarPending,
    isSectionStructurePending: sectionStructurePending,
    joinChannelById,
    leaveCurrentChannel,
    moveChannelToSection,
    patchChannel,
    renameChannelSection,
    reorderChannelSection,
    retrySections: refreshSections,
    setChannelSectionSidebar,
    searchBrowsableChannels,
    sections,
    sectionsError: () => rawSections.error,
    sectionsLoading: () => rawSections.loading,
    toggleChannelStar,
    toggleSectionFilter,
  };
}
