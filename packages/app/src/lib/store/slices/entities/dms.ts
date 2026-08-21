import { createMemo } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type { DirectMessage, User } from "../../../api";
import { closeDm, fetchChannelMembers, openDm } from "../../../api";
import { actionFeedback } from "../../../feedback";
import type { View } from "../types";

export function createDmsSlice(deps: {
  bootstrap: () => { directMessages: DirectMessage[] } | undefined;
  closeUserProfile: () => void;
  currentUser: () => User | undefined;
  activeView: () => View | null;
  setActiveView: (view: View) => void;
}) {
  const [extraDms, setExtraDms] = createStore<DirectMessage[]>([]);
  const [closedDmIds, setClosedDmIds] = createStore<Record<string, boolean>>({});

  const [dmPatches, setDmPatches] = createStore<Record<string, Partial<DirectMessage>>>({});
  const [openDmPendingByUser, setOpenDmPendingByUser] = createStore<Record<string, boolean>>({});
  const [closeDmPendingById, setCloseDmPendingById] = createStore<Record<string, boolean>>({});
  const pendingMpdms = new Set<string>();

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

  function dmById(id: string): DirectMessage | undefined {
    return allDirectMessages().find((d) => d.id === id);
  }

  function dmIdForUser(userId: string): string | undefined {
    return allDirectMessages().find((d) => d.userId === userId)?.id;
  }

  function ensureDm(channelId: string, userId: string) {
    if (allDirectMessages().some((d) => d.id === channelId)) return;
    setExtraDms(produce((list) => list.push({ id: channelId, unread: true, userId })));
  }

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
      await closeDm(dmId);
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
  };
}
