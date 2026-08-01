// biome-ignore-all lint/style/noExcessiveLinesPerFile: One cohesive channel entity slice with shared optimistic section state.
import type { BrowsableChannel, Channel, ChannelSection, UserPrefs } from "@slock/slack-api";
import {
  createSection as apiCreateSection,
  deleteSection as apiDeleteSection,
  renameSection as apiRenameSection,
  reorderSection as apiReorderSection,
  setSectionSidebar as apiSetSectionSidebar,
  updateSectionChannels as apiUpdateSectionChannels,
  fetchBrowsableChannels,
  fetchChannelDetails,
  fetchFlaronChannel,
  fetchSections,
  joinChannel,
  leaveChannel,
  toggleStar,
} from "@slock/slack-api";
import { createEffect, createMemo, createResource, createSignal, type Setter } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { actionFeedback } from "../feedback";
import type { Nav, View } from "../types";
import type { ChannelPlacementOutcome } from "./mutations/channelPlacementOutcome";
import { removeSectionChannelsBatched } from "./mutations/sectionChannelRemovals";
import { reorderSections } from "./mutations/sectionOrder";
import { setSectionSidebarPreference } from "./mutations/sectionSidebarPrefs";

export function createChannelsSlice(deps: {
  bootstrap: () => { channels: Channel[]; starredChannelIds: string[] } | undefined;
  activeView: () => View | null;
  nav: () => Nav;
  setActiveView: (view: View) => void;
  userPrefs: () => UserPrefs | undefined;
  mutateUserPrefs: Setter<UserPrefs | undefined>;
}) {
  const [extraChannels, setExtraChannels] = createStore<Channel[]>([]);
  // Channels resolved only for display purposes (e.g. a #channel mention link
  // pointing at a channel the user has never joined) — kept separate from
  // `extraChannels` so a lookup never makes an unjoined channel show up in
  // the sidebar via `channels()`.
  const [discoveredChannels, setDiscoveredChannels] = createStore<Channel[]>([]);
  const pendingChannels = new Set<string>();
  const channelDiscoveryMisses = new Map<string, number>();
  const channelDiscoveryRetryMs = 30_000;
  const channelDetailsRequested = new Set<string>();
  // Local edits (rename, topic) on top of the immutable bootstrap snapshot,
  // applied when `channels()` assembles its list.
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

  // Channels newly joined/created this session — bootstrap() is a resource
  // snapshot from boot, not a store, so a freshly joined channel needs to be
  // merged in here rather than mutating that snapshot.
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

  // conversations.info resolves public channels fine even when we're not a
  // member; it only fails for private channels we're not in, which is the
  // one case Flaron (an external, unauthenticated lookup) is for.
  async function discoverChannel(id: string): Promise<boolean> {
    let channel: Channel | null;
    try {
      const details = await fetchChannelDetails(id);
      channel = {
        id: details.id,
        name: details.name,
        private: details.private,
        topic: details.topic,
        unread: false,
      };
    } catch {
      channel = await fetchFlaronChannel(id);
    }
    if (!channel) return false;
    setDiscoveredChannels(produce((list) => list.push(channel)));
    return true;
  }

  function channelById(id: string): Channel | undefined {
    const known = knownChannelById(id);
    if (known) return known;
    // Bootstrap hasn't resolved yet, so we can't tell a genuinely external
    // channel apart from one of this account's own that just hasn't loaded —
    // wait rather than wrongly treating it as external and hitting Flaron.
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

  // Read-only lookup for dense lists such as Activity. Unlike channelById,
  // this never turns rendering an unknown channel label into network I/O.
  function knownChannelById(id: string): Channel | undefined {
    return channels().find((c) => c.id === id) ?? discoveredChannels.find((c) => c.id === id);
  }

  // client.userBoot can omit topic metadata for a channel. Resolve it lazily
  // from the authenticated conversations.info response, then patch the
  // reactive channel snapshot. Only called from the couple of places that
  // actually display a topic (channel header, #mention hover card) - not
  // from channelById itself, which is called for every channel referenced
  // anywhere in the UI (message lists, activity feed, etc.) and would
  // otherwise fire a conversations.info burst for channels that never show
  // their topic.
  function ensureChannelTopic(id: string): void {
    const known = channels().find((c) => c.id === id);
    if (!known || known.topic || channelDetailsRequested.has(id)) return;
    channelDetailsRequested.add(id);
    fetchChannelDetails(id)
      .then((details) => {
        if (details.topic) patchChannel(id, { topic: details.topic });
      })
      .catch(() => channelDetailsRequested.delete(id));
  }

  function isChannelMember(id: string): boolean {
    return channels().some((c) => c.id === id);
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

  // ---- sections ----

  const [rawSections, { refetch: refetchSections, mutate: mutateSections }] = createResource(
    () => (deps.nav() === "home" ? true : undefined),
    fetchSections,
  );
  const [sectionStructurePending, setSectionStructurePending] = createSignal(false);
  const [sectionSidebarPendingById, setSectionSidebarPendingById] = createStore<
    Record<string, boolean>
  >({});
  async function refreshSections(): Promise<ChannelSection[] | null | undefined> {
    try {
      return await refetchSections();
    } catch {
      // The resource retains its error for the sidebar's retry state. Callers
      // should not become unhandled rejected event promises just because the
      // follow-up refresh after a successful mutation failed.
    }
  }
  // Neither a section's `sort` nor its `sidebar` filter is carried reliably by
  // users.channelSections.list — both live in the separate users.prefs
  // "channel_sections" blob — so merge them in here rather than teaching every
  // section resource consumer about two sources.
  const sections = createMemo<ChannelSection[] | undefined>(() => {
    const list = rawSections();
    if (!list) return list;
    const prefs = deps.userPrefs();
    const sectionSort = prefs?.sectionSort ?? {};
    const sectionSidebar = prefs?.sectionSidebar ?? {};
    return list.map((s) => {
      const sort = sectionSort[s.id];
      const sidebar = sectionSidebar[s.id] ?? s.sidebar;
      if (!sort && sidebar === s.sidebar) return s;
      return { ...s, sidebar, ...(sort ? { sort } : {}) };
    });
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
    // The filter lives in the users.prefs "channel_sections" blob, so drive the
    // optimistic update through there — mutating rawSections would be undone by
    // the next refetch, which doesn't carry the sidebar value.
    const prev = deps.userPrefs();
    if (!prev) {
      actionFeedback.flash(
        sectionId,
        "Preferences are unavailable. Try loading them again.",
        "error",
      );
      return false;
    }
    const previousSidebar = prev.sectionSidebar[sectionId];
    setSectionSidebarPendingById(sectionId, true);
    actionFeedback.clear(sectionId);
    deps.mutateUserPrefs((current) =>
      current ? setSectionSidebarPreference(current, sectionId, sidebar) : current,
    );
    const rollback = () =>
      deps.mutateUserPrefs((current) =>
        current ? setSectionSidebarPreference(current, sectionId, previousSidebar) : current,
      );
    try {
      if (await apiSetSectionSidebar(sectionId, sidebar)) return true;
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

  // Moves `sectionId` to sit directly above `nextSectionId` (or to the
  // bottom of the list when null). Reordered optimistically so a drag feels
  // instant; rolled back if the server call fails.
  async function reorderChannelSection(
    sectionId: string,
    nextSectionId: string | null,
  ): Promise<boolean> {
    if (sectionStructurePending()) return false;
    const current = sections() ?? [];
    const optimistic = reorderSections(current, sectionId, nextSectionId);
    if (!optimistic) return false;
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

      // Starred and sectioned are mutually exclusive in the real client — starring a
      // channel pulls it out of whatever section it was in.
      const from = (sections() ?? []).find(
        (section) => section.type === "standard" && section.channelIds.includes(channelId),
      );
      if (from && !(await apiUpdateSectionChannels(from.id, { removeChannelIds: [channelId] }))) {
        actionFeedback.flash(
          channelId,
          "Starred, but couldn’t remove the channel from its previous section.",
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
          "Starred, but couldn’t remove the channel from its previous section.",
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

  // Slack's bulkUpdate is scoped to one section at a time, so moving a channel
  // between two custom sections is a remove-then-insert pair rather than one call.
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
        const ok = await apiUpdateSectionChannels(from.id, { removeChannelIds: [channelId] });
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
          if (from) await apiUpdateSectionChannels(from.id, { insertChannelIds: [channelId] });
          actionFeedback.flash(channelId, "Failed to move channel.", "error");
          await refreshSections();
          return "failed";
        }
        insertedIntoTarget = true;
        // Starred and sectioned are mutually exclusive in the real client — a channel
        // moved into a section drops out of Starred.
        if (isChannelStarred(channelId)) {
          setStarredChannelIds(channelId, false);
          try {
            await toggleStar(channelId, true);
          } catch (err) {
            console.error("Failed to unstar channel", err);
            setStarredChannelIds(channelId, true);
            actionFeedback.flash(
              channelId,
              "Moved, but couldn’t remove the channel from Starred.",
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
          await apiUpdateSectionChannels(from.id, { insertChannelIds: [channelId] });
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

  // Batched so closing several DMs at once (e.g. dormant-DM auto-close) costs one
  // bulkUpdate per section plus one refetch, instead of a round-trip pair per DM.
  async function removeDmsFromSidebar(dmIds: string[]): Promise<Set<string>> {
    if (dmIds.length === 0) return new Set();
    const current = sections() ?? [];
    const list = current.length > 0 ? current : ((await refreshSections()) ?? []);
    const fallback =
      list.find((s) => s.type === "direct_messages") ?? list.find((s) => s.id === "sm1");
    const idsBySection = new Map<string, string[]>();
    for (const dmId of dmIds) {
      const section =
        list.find((s) => s.type === "direct_messages" && s.channelIds.includes(dmId)) ?? fallback;
      if (!section) continue;
      idsBySection.set(section.id, [...(idsBySection.get(section.id) ?? []), dmId]);
    }
    const removed = await removeSectionChannelsBatched(
      [...idsBySection.entries()],
      (sectionId, ids) =>
        apiUpdateSectionChannels(sectionId, {
          removeChannelIds: ids,
        }),
      (sectionId, error) =>
        console.error(`Failed to remove conversations from section ${sectionId}`, error),
    );
    if (removed.size > 0) await refreshSections();
    return removed;
  }

  async function removeDmFromSidebar(dmId: string): Promise<boolean> {
    const removed = await removeDmsFromSidebar([dmId]);
    if (!removed.has(dmId)) {
      actionFeedback.flash(dmId, "Failed to close conversation.", "error");
      return false;
    }
    return true;
  }

  // ---- channel directory: browse ----

  async function searchBrowsableChannels(query: string) {
    const found = await fetchBrowsableChannels(query);
    setBrowsableChannels(found);
  }

  return {
    browsableChannels,
    channelById,
    channels,
    createChannelSection,
    deleteChannelSection,
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
    knownChannelById,
    patchChannel,
    renameChannelSection,
    reorderChannelSection,
    removeDmFromSidebar,
    removeDmsFromSidebar,
    retrySections: refreshSections,
    setChannelSectionSidebar,
    searchBrowsableChannels,
    sections,
    sectionsError: () => rawSections.error,
    sectionsLoading: () => rawSections.loading,
    toggleChannelStar,
  };
}
