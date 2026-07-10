import type { BrowsableChannel, Channel } from "@slock/slack-api";
import {
  createSection as apiCreateSection,
  deleteSection as apiDeleteSection,
  renameSection as apiRenameSection,
  updateSectionChannels as apiUpdateSectionChannels,
  fetchBrowsableChannels,
  fetchFlaronChannel,
  fetchSections,
  joinChannel,
  leaveChannel,
  toggleStar,
} from "@slock/slack-api";
import { createEffect, createMemo, createResource, createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { actionFeedback } from "./feedback";
import type { View } from "./types";

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

  function channelById(id: string): Channel | undefined {
    const known = channels().find((c) => c.id === id);
    if (known) return known;
    const discovered = discoveredChannels.find((c) => c.id === id);
    if (discovered) return discovered;
    if (!pendingChannels.has(id)) {
      pendingChannels.add(id);
      fetchFlaronChannel(id)
        .then((channel) => {
          if (channel) setDiscoveredChannels(produce((list) => list.push(channel)));
        })
        .catch(() => {
          pendingChannels.delete(id);
        });
    }
    return undefined;
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
      deps.setActiveView({ kind: "channel", id: channel.id });
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
        if (next) deps.setActiveView({ kind: "channel", id: next.id });
      }
    } catch (err) {
      console.error("Failed to leave channel", err);
      actionFeedback.flash(channelId, "Failed to leave channel.", "error");
    }
  }

  // ---- sections ----

  const [sections, { refetch: refetchSections }] = createResource(fetchSections);

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
      const from = (sections() ?? []).find((s) => s.channelIds.includes(channelId));
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
    const from = current.find((s) => s.channelIds.includes(channelId) && s.id !== targetSectionId);
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

  // ---- channel directory: browse ----

  async function searchBrowsableChannels(query: string) {
    const found = await fetchBrowsableChannels(query);
    setBrowsableChannels(found);
  }

  return {
    channels,
    patchChannel,
    channelById,
    isChannelMember,
    isChannelLeft,
    joinChannelById,
    leaveCurrentChannel,
    sections,
    createChannelSection,
    renameChannelSection,
    deleteChannelSection,
    moveChannelToSection,
    isChannelStarred,
    toggleChannelStar,
    browsableChannels,
    searchBrowsableChannels,
  };
}
