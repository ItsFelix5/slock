import type { DirectMessage, User } from "@slock/slack-api";
import { fetchChannelMembers, openDm } from "@slock/slack-api";
import { createEffect, createMemo, onCleanup } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { actionFeedback } from "../feedback";
import type { View } from "../types";

const DM_AUTO_CLOSE_MS = 7 * 24 * 60 * 60 * 1000;

export function createDmsSlice(deps: {
  bootstrap: () => { directMessages: DirectMessage[] } | undefined;
  closeUserProfile: () => void;
  currentUser: () => User | undefined;
  unreadChannelIds: Record<string, boolean>;
  removeDmFromSidebar: (dmId: string) => Promise<boolean>;
  removeDmsFromSidebar: (dmIds: string[]) => Promise<Set<string>>;
  activeView: () => View | null;
  setActiveView: (view: View) => void;
}) {
  const [extraDms, setExtraDms] = createStore<DirectMessage[]>([]);
  const [closedDmIds, setClosedDmIds] = createStore<Record<string, boolean>>({});
  const [dmLastActivity, setDmLastActivity] = createStore<Record<string, number>>({});
  // Local edits (e.g. live mention-count updates) on top of the immutable bootstrap
  // snapshot, applied when `allDirectMessages()` assembles its list.
  const [dmPatches, setDmPatches] = createStore<Record<string, Partial<DirectMessage>>>({});
  const [openDmPendingByUser, setOpenDmPendingByUser] = createStore<Record<string, boolean>>({});
  const [closeDmPendingById, setCloseDmPendingById] = createStore<Record<string, boolean>>({});
  let dmActivitySeeded = false;
  let autoCloseTimer: ReturnType<typeof setInterval> | null = null;
  const pendingMpdms = new Set<string>();

  // All known DMs regardless of local close state, so reopening/lookups can still find them.
  const allDirectMessages = createMemo<DirectMessage[]>(() => {
    const base = deps.bootstrap()?.directMessages ?? [];
    const extra = extraDms.filter((dm) => !base.some((b) => b.id === dm.id));
    return [...base, ...extra].map((dm) =>
      dmPatches[dm.id] ? { ...dm, ...dmPatches[dm.id] } : dm,
    );
  });

  function patchDm(id: string, patch: Partial<DirectMessage>) {
    setDmPatches(id, { ...dmPatches[id], ...patch });
  }

  const directMessages = createMemo<DirectMessage[]>(() =>
    allDirectMessages().filter((dm) => !closedDmIds[dm.id]),
  );

  // Mirrors Slack's own "dormant" DM cleanup: a DM nobody has touched in a week
  // quietly closes itself (still reachable again via compose/search) so the
  // sidebar doesn't accumulate every one-off conversation forever. Batched into
  // one removal request rather than one round-trip pair per stale DM.
  async function autoCloseInactiveDms() {
    const now = Date.now();
    const view = deps.activeView();
    const staleIds = directMessages()
      .filter((dm) => {
        if (view?.kind === "dm" && view.id === dm.id) return false;
        if (deps.unreadChannelIds[dm.id]) return false;
        const last = dmLastActivity[dm.id];
        return !!last && now - last >= DM_AUTO_CLOSE_MS;
      })
      .map((dm) => dm.id);
    if (staleIds.length === 0) return;
    const removed = await deps.removeDmsFromSidebar(staleIds);
    for (const id of removed) setClosedDmIds(id, true);
  }

  createEffect(() => {
    const data = deps.bootstrap();
    if (!data || dmActivitySeeded) return;
    dmActivitySeeded = true;
    for (const dm of data.directMessages) {
      if (dm.lastActivity) setDmLastActivity(dm.id, dm.lastActivity);
    }
    autoCloseInactiveDms();
    autoCloseTimer = setInterval(autoCloseInactiveDms, 60 * 60 * 1000);
  });
  onCleanup(() => {
    if (autoCloseTimer) clearInterval(autoCloseTimer);
  });

  function dmById(id: string): DirectMessage | undefined {
    return allDirectMessages().find((d) => d.id === id);
  }

  function dmIdForUser(userId: string): string | undefined {
    return allDirectMessages().find((d) => d.userId === userId)?.id;
  }

  // Called when a message arrives on a DM channel we've never seen before (someone
  // opened a DM with us for the first time this session) so it can show up in the
  // sidebar without waiting for a full reload.
  function ensureDm(channelId: string, userId: string) {
    if (allDirectMessages().some((d) => d.id === channelId)) return;
    setExtraDms(produce((list) => list.push({ id: channelId, unread: true, userId })));
  }

  // Search can surface a message from a multi-person DM the boot payload never sent
  // (mpims are only included there while `is_open`, see fetchBootstrap) — this backfills
  // it into extraDms from its member list so dmById/dmDisplayName resolve it normally
  // instead of the caller falling back to Slack's raw "mpdm-alice--bob--carol-1" id.
  async function ensureMpdm(channelId: string) {
    if (allDirectMessages().some((d) => d.id === channelId) || pendingMpdms.has(channelId)) return;
    pendingMpdms.add(channelId);
    try {
      const { members } = await fetchChannelMembers(channelId, "everyone");
      const selfId = deps.currentUser()?.id;
      const memberIds = members.map((u) => u.id).filter((id) => id !== selfId);
      setExtraDms(produce((list) => list.push({ id: channelId, memberIds, unread: false })));
    } catch {
      pendingMpdms.delete(channelId);
    }
  }

  function isOpenDmPending(userId: string): boolean {
    return !!openDmPendingByUser[userId];
  }

  function isCloseDmPending(dmId: string): boolean {
    return !!closeDmPendingById[dmId];
  }

  async function openDmWithUser(userId: string): Promise<boolean> {
    if (isOpenDmPending(userId)) return false;
    setOpenDmPendingByUser(userId, true);
    try {
      const existing = allDirectMessages().find((d) => d.userId === userId);
      if (existing && !closedDmIds[existing.id]) {
        deps.setActiveView({ id: existing.id, kind: "dm" });
        deps.closeUserProfile();
        return true;
      }
      const channelId = await openDm(userId);
      if (!channelId) {
        actionFeedback.flash(userId, "Could not open a direct message with this user.", "error");
        return false;
      }
      if (existing) setClosedDmIds(channelId, false);
      else
        setExtraDms(
          produce((list) => {
            if (!list.some((dm) => dm.id === channelId))
              list.push({ id: channelId, unread: false, userId });
          }),
        );
      deps.setActiveView({ id: channelId, kind: "dm" });
      deps.closeUserProfile();
      return true;
    } catch (err) {
      console.error("Failed to open direct message", err);
      actionFeedback.flash(userId, "Could not open a direct message with this user.", "error");
      return false;
    } finally {
      setOpenDmPendingByUser(userId, false);
    }
  }

  async function closeDmConversation(dmId: string): Promise<boolean> {
    if (isCloseDmPending(dmId)) return false;
    setCloseDmPendingById(dmId, true);
    try {
      if (!(await deps.removeDmFromSidebar(dmId))) return false;
      setClosedDmIds(dmId, true);
      const view = deps.activeView();
      if (view?.kind === "dm" && view.id === dmId) {
        const next = directMessages().find((d) => d.id !== dmId);
        if (next) deps.setActiveView({ id: next.id, kind: "dm" });
      }
      return true;
    } catch (err) {
      console.error("Failed to close direct message", err);
      actionFeedback.flash(dmId, "Failed to close conversation.", "error");
      return false;
    } finally {
      setCloseDmPendingById(dmId, false);
    }
  }

  return {
    allDirectMessages,
    closeDmConversation,
    closedDmIds,
    directMessages,
    dmById,
    dmIdForUser,
    ensureDm,
    ensureMpdm,
    isCloseDmPending,
    isOpenDmPending,
    openDmWithUser,
    patchDm,
    setClosedDmIds,
    setDmLastActivity,
  };
}
