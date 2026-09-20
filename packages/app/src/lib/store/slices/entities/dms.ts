import { createMemo } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type { DirectMessage, User } from "../../../api";
import { closeDm, fetchChannelMembers, openDm } from "../../../api";
import { actionFeedback } from "../../../feedback";
import { queryClient } from "../../../queryClient";
import type { View } from "../types";

export function isDmId(id: string, isKnownDm: (id: string) => boolean): boolean {
  return id.startsWith("D") || isKnownDm(id);
}

export function createDmsSlice(deps: {
  bootstrap: () => { directMessages: DirectMessage[] } | undefined;
  closeUserProfile: () => void;
  currentUser: () => User | undefined;
  activeView: () => View | null;
  setActiveView: (view: View) => void;
  openInPane: (view: View) => string;
}) {
  const [extraDms, setExtraDms] = createStore<DirectMessage[]>([]);
  const [closedDmIds, setClosedDmIds] = createStore<Record<string, boolean>>({});

  const [dmPatches, setDmPatches] = createStore<Record<string, Partial<DirectMessage>>>({});
  const [openDmPendingByUser, setOpenDmPendingByUser] = createStore<Record<string, boolean>>({});
  const [closeDmPendingById, setCloseDmPendingById] = createStore<Record<string, boolean>>({});

  const baseDmsById = createMemo(() => {
    const base = deps.bootstrap()?.directMessages ?? [];
    const extra = extraDms.filter((dm) => !base.some((b) => b.id === dm.id));
    return new Map([...base, ...extra].map((dm) => [dm.id, dm]));
  });
  const allDirectMessages = createMemo<DirectMessage[]>(() =>
    [...baseDmsById().values()].map((dm) =>
      dmPatches[dm.id] ? { ...dm, ...dmPatches[dm.id] } : dm,
    ),
  );

  function patchDm(id: string, patch: Partial<DirectMessage>) {
    setDmPatches(id, { ...dmPatches[id], ...patch });
  }

  const directMessages = createMemo<DirectMessage[]>(() =>
    allDirectMessages().filter((dm) => !closedDmIds[dm.id]),
  );

  const dmsByUserId = createMemo(() => {
    const map = new Map<string, DirectMessage>();
    for (const dm of allDirectMessages()) if (dm.userId) map.set(dm.userId, dm);
    return map;
  });

  function dmById(id: string): DirectMessage | undefined {
    const base = baseDmsById().get(id);
    const patch = dmPatches[id];
    return base && patch ? { ...base, ...patch } : base;
  }

  function conversationKind(id: string): "channel" | "dm" {
    return isDmId(id, (candidate) => !!dmById(candidate)) ? "dm" : "channel";
  }

  function dmIdForUser(userId: string): string | undefined {
    return dmsByUserId().get(userId)?.id;
  }

  function ensureDm(channelId: string, userId: string) {
    if (baseDmsById().has(channelId)) return;
    setExtraDms(produce((list) => list.push({ id: channelId, unread: true, userId })));
  }

  async function ensureMpdm(channelId: string) {
    if (baseDmsById().has(channelId)) return;
    await queryClient.ensureQueryData({
      queryKey: ["mpdmMembers", channelId],
      queryFn: async () => {
        const { members } = await fetchChannelMembers(channelId, "everyone");
        const selfId = deps.currentUser()?.id;
        const memberIds = members.map((u) => u.id).filter((id) => id !== selfId);
        setExtraDms(produce((list) => list.push({ id: channelId, memberIds, unread: false })));
        return true;
      },
    });
  }

  function isOpenDmPending(userId: string): boolean {
    return !!openDmPendingByUser[userId];
  }

  function isCloseDmPending(dmId: string): boolean {
    return !!closeDmPendingById[dmId];
  }

  async function openDmWithUser(userId: string, options?: { split?: boolean }): Promise<boolean> {
    if (isOpenDmPending(userId)) return false;
    setOpenDmPendingByUser(userId, true);
    const openView = (view: View) =>
      options?.split ? deps.openInPane(view) : deps.setActiveView(view);
    try {
      const existing = dmsByUserId().get(userId);
      if (existing && !closedDmIds[existing.id]) {
        openView({ id: existing.id, kind: "dm" });
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
      openView({ id: channelId, kind: "dm" });
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
    conversationKind,
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
