// biome-ignore-all lint/style/noExcessiveLinesPerFile: One cohesive channel entity slice with shared optimistic section state.
import type { BrowsableChannel, Channel, ChannelSection } from "@slock/slack-api";
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
import { createEffect, createMemo, createResource, createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { actionFeedback } from "../feedback";
import type { View } from "../types";

export function createChannelsSlice(deps: {
  bootstrap: () => { channels: Channel[]; starredChannelIds: string[] } | undefined;
  activeView: () => View | null;
  setActiveView: (view: View) => void;
}) {
  const [extraChannels, setExtraChannels] = createStore<Channel[]>([]);
  // Channels resolved only for display purposes (e.g. a #channel mention link
  // pointing at a channel the user has never joined) — kept separate from
  // `extraChannels` so a lookup never makes an unjoined channel show up in
  // the sidebar via `channels()`.
  const [discoveredChannels, setDiscoveredChannels] = createStore<Channel[]>([]);
  const pendingChannels = new Set<string>();
  const channelDetailsRequested = new Set<string>();
  // Local edits (rename, topic) on top of the immutable bootstrap snapshot,
  // applied when `channels()` assembles its list.
  const [channelPatches, setChannelPatches] = createStore<Record<string, Partial<Channel>>>({});
  const [leftChannelIds, setLeftChannelIds] = createStore<Record<string, boolean>>({});
  const [starredChannelIds, setStarredChannelIds] = createStore<Record<string, boolean>>({});
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
  async function discoverChannel(id: string) {
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
    if (channel) setDiscoveredChannels(produce((list) => list.push(channel)));
  }

  function channelById(id: string): Channel | undefined {
    const known = channels().find((c) => c.id === id);
    if (known) return known;
    const discovered = discoveredChannels.find((c) => c.id === id);
    if (discovered) return discovered;
    // Bootstrap hasn't resolved yet, so we can't tell a genuinely external
    // channel apart from one of this account's own that just hasn't loaded —
    // wait rather than wrongly treating it as external and hitting Flaron.
    if (!deps.bootstrap()) return;
    if (!pendingChannels.has(id)) {
      pendingChannels.add(id);
      discoverChannel(id).catch(() => {
        pendingChannels.delete(id);
      });
    }
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
      .catch(() => {});
  }

  function isChannelMember(id: string): boolean {
    return channels().some((c) => c.id === id);
  }

  function isChannelLeft(channelId: string): boolean {
    return !!leftChannelIds[channelId];
  }

  async function joinChannelById(channelId: string) {
    try {
      const channel = await joinChannel(channelId);
      setExtraChannels(produce((list) => list.push(channel)));
      setLeftChannelIds(channelId, false);
      deps.setActiveView({ id: channel.id, kind: "channel" });
    } catch (err) {
      console.error("Failed to join channel", err);
      actionFeedback.flash(channelId, "Failed to join channel.", "error");
    }
  }

  async function leaveCurrentChannel(channelId: string) {
    try {
      await leaveChannel(channelId);
      setLeftChannelIds(channelId, true);
      if (deps.activeView()?.id === channelId) {
        const next = channels().find((c) => c.id !== channelId && !isChannelLeft(c.id));
        if (next) deps.setActiveView({ id: next.id, kind: "channel" });
      }
    } catch (err) {
      console.error("Failed to leave channel", err);
      actionFeedback.flash(channelId, "Failed to leave channel.", "error");
    }
  }

  // ---- sections ----

  const [sections, { refetch: refetchSections, mutate: mutateSections }] =
    createResource(fetchSections);

  async function createChannelSection(
    name: string,
    feedbackKey = name,
  ): Promise<{ id: string; name: string } | null> {
    const created = await apiCreateSection(name);
    if (!created) {
      actionFeedback.flash(feedbackKey, "Failed to create section.", "error");
      return null;
    }
    await refetchSections();
    return created;
  }

  async function renameChannelSection(sectionId: string, name: string) {
    const ok = await apiRenameSection(sectionId, name);
    if (!ok) {
      actionFeedback.flash(sectionId, "Failed to rename section.", "error");
      return;
    }
    await refetchSections();
  }

  async function deleteChannelSection(sectionId: string) {
    const ok = await apiDeleteSection(sectionId);
    if (!ok) {
      actionFeedback.flash(sectionId, "Failed to delete section.", "error");
      return;
    }
    await refetchSections();
  }

  async function setChannelSectionSidebar(sectionId: string, sidebar: ChannelSection["sidebar"]) {
    const current = sections() ?? [];
    const section = current.find((candidate) => candidate.id === sectionId);
    if (!section || section.sidebar === sidebar) return;
    mutateSections(
      current.map((candidate) =>
        candidate.id === sectionId ? { ...candidate, sidebar } : candidate,
      ),
    );
    if (!(await apiSetSectionSidebar(sectionId, sidebar))) {
      actionFeedback.flash(sectionId, "Failed to update section filter.", "error");
      mutateSections(current);
      return;
    }
    await refetchSections();
  }

  // Moves `sectionId` to sit directly above `nextSectionId` (or to the
  // bottom of the list when null). Reordered optimistically so a drag feels
  // instant; rolled back if the server call fails.
  async function reorderChannelSection(sectionId: string, nextSectionId: string | null) {
    const current = sections() ?? [];
    const moved = current.find((s) => s.id === sectionId);
    if (!moved) return;
    const without = current.filter((s) => s.id !== sectionId);
    const insertAt = nextSectionId ? without.findIndex((s) => s.id === nextSectionId) : -1;
    const target = insertAt === -1 ? without.length : insertAt;
    const optimistic: ChannelSection[] = [
      ...without.slice(0, target),
      moved,
      ...without.slice(target),
    ];
    mutateSections(optimistic);

    const ok = await apiReorderSection(sectionId, nextSectionId);
    if (!ok) {
      actionFeedback.flash(sectionId, "Failed to reorder section.", "error");
      mutateSections(current);
      return;
    }
    await refetchSections();
  }

  function isChannelStarred(channelId: string): boolean {
    return !!starredChannelIds[channelId];
  }

  async function toggleChannelStar(channelId: string) {
    const currentlyStarred = isChannelStarred(channelId);
    setStarredChannelIds(channelId, !currentlyStarred);
    try {
      await toggleStar(channelId, currentlyStarred);
    } catch (err) {
      console.error("Failed to toggle star", err);
      actionFeedback.flash(channelId, "Failed to update star.", "error");
      setStarredChannelIds(channelId, currentlyStarred);
      return;
    }
    // Starred and sectioned are mutually exclusive in the real client — starring a
    // channel pulls it out of whatever section it was in.
    if (!currentlyStarred) {
      const from = (sections() ?? []).find(
        (s) => s.type === "standard" && s.channelIds.includes(channelId),
      );
      if (from) {
        await apiUpdateSectionChannels(from.id, { removeChannelIds: [channelId] });
        await refetchSections();
      }
    }
  }

  // Slack's bulkUpdate is scoped to one section at a time, so moving a channel
  // between two custom sections is a remove-then-insert pair rather than one call.
  async function moveChannelToSection(channelId: string, targetSectionId: string | null) {
    const current = sections() ?? [];
    const from = current.find(
      (s) => s.type === "standard" && s.channelIds.includes(channelId) && s.id !== targetSectionId,
    );
    if (from) {
      const ok = await apiUpdateSectionChannels(from.id, { removeChannelIds: [channelId] });
      if (!ok) {
        actionFeedback.flash(channelId, "Failed to move channel.", "error");
        return;
      }
    }
    if (targetSectionId) {
      const ok = await apiUpdateSectionChannels(targetSectionId, { insertChannelIds: [channelId] });
      if (!ok) {
        actionFeedback.flash(channelId, "Failed to move channel.", "error");
        return;
      }
      // Starred and sectioned are mutually exclusive in the real client — a channel
      // moved into a section drops out of Starred.
      if (isChannelStarred(channelId)) {
        setStarredChannelIds(channelId, false);
        toggleStar(channelId, true).catch((err) => {
          console.error("Failed to unstar channel", err);
          setStarredChannelIds(channelId, true);
        });
      }
    }
    await refetchSections();
  }

  // Batched so closing several DMs at once (e.g. dormant-DM auto-close) costs one
  // bulkUpdate per section plus one refetch, instead of a round-trip pair per DM.
  async function removeDmsFromSidebar(dmIds: string[]): Promise<Set<string>> {
    const removed = new Set<string>();
    if (dmIds.length === 0) return removed;
    const current = sections() ?? [];
    const list = current.length > 0 ? current : ((await refetchSections()) ?? []);
    const fallback =
      list.find((s) => s.type === "direct_messages") ?? list.find((s) => s.id === "sm1");
    const idsBySection = new Map<string, string[]>();
    for (const dmId of dmIds) {
      const section =
        list.find((s) => s.type === "direct_messages" && s.channelIds.includes(dmId)) ?? fallback;
      if (!section) continue;
      idsBySection.set(section.id, [...(idsBySection.get(section.id) ?? []), dmId]);
    }
    await Promise.all(
      [...idsBySection.entries()].map(async ([sectionId, ids]) => {
        const ok = await apiUpdateSectionChannels(sectionId, { removeChannelIds: ids });
        if (ok) for (const id of ids) removed.add(id);
      }),
    );
    if (removed.size > 0) await refetchSections();
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
    isChannelStarred,
    joinChannelById,
    leaveCurrentChannel,
    moveChannelToSection,
    patchChannel,
    renameChannelSection,
    reorderChannelSection,
    removeDmFromSidebar,
    removeDmsFromSidebar,
    setChannelSectionSidebar,
    searchBrowsableChannels,
    sections,
    toggleChannelStar,
  };
}
