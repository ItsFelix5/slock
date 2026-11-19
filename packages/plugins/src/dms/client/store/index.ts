import { service } from "@slock/core/solid";
import type { ChannelId, DirectMessage, User, UserId } from "@slock/types";
import { createMemo } from "solid-js";
import { createStore, produce } from "solid-js";
import type { View } from "../../../conversations/client/api/types";
import { defineKey } from "../../../query/client/api";
import { closeDm, fetchChannelMembers, openDm } from "../../../slack/client/api";
import { isDmId } from "../api";

const mpdmMembersKey = defineKey<[ChannelId]>("mpdmMembers");

const feedback = service("feedback");

const query = service("query");

export function createDmsStore(deps: {
  bootstrap: () => { directMessages: DirectMessage[] } | undefined;
  closeUserProfile: () => void;
  currentUser: () => User | undefined;
  activeView: () => View | null;
  setActiveView: (view: View) => void;
  openInPane: (view: View) => string;
}) {
  const [extraDms, setExtraDms] = createStore<DirectMessage[]>([]);
  const [closedDmIds, setClosedDmIds] = createStore<Record<ChannelId, boolean>>({});

  const [dmPatches, setDmPatches] = createStore<Record<ChannelId, Partial<DirectMessage>>>({});
  const [openDmPendingByUser, setOpenDmPendingByUser] = createStore<Record<UserId, boolean>>({});
  const [closeDmPendingById, setCloseDmPendingById] = createStore<Record<ChannelId, boolean>>({});

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

  function patchDm(id: ChannelId, patch: Partial<DirectMessage>) {
    setDmPatches(id, { ...dmPatches[id], ...patch });
  }

  const directMessages = createMemo<DirectMessage[]>(() =>
    allDirectMessages().filter((dm) => !closedDmIds[dm.id]),
  );

  const dmsByUserId = createMemo(() => {
    const map = new Map<UserId, DirectMessage>();
    for (const dm of allDirectMessages()) if (dm.userId) map.set(dm.userId, dm);
    return map;
  });

  function dmById(id: ChannelId): DirectMessage | undefined {
    const base = baseDmsById().get(id);
    const patch = dmPatches[id];
    return base && patch ? { ...base, ...patch } : base;
  }

  function conversationKind(id: ChannelId): "channel" | "dm" {
    return isDmId(id, (candidate) => !!dmById(candidate)) ? "dm" : "channel";
  }

  function dmIdForUser(userId: UserId): ChannelId | undefined {
    return dmsByUserId().get(userId)?.id;
  }

  function ensureDm(channelId: ChannelId, userId: UserId) {
    if (baseDmsById().has(channelId)) return;
    setExtraDms(produce((list) => list.push({ id: channelId, unread: true, userId })));
  }

  async function ensureMpdm(channelId: ChannelId) {
    if (baseDmsById().has(channelId)) return;
    await query.client.query({
      queryKey: mpdmMembersKey(channelId),
      staleTime: "static",
      queryFn: async () => {
        const { members } = await fetchChannelMembers(channelId, "everyone");
        const selfId = deps.currentUser()?.id;
        const memberIds = members.map((u) => u.id).filter((id) => id !== selfId);
        setExtraDms(produce((list) => list.push({ id: channelId, memberIds, unread: false })));
        return true;
      },
    });
  }

  function isOpenDmPending(userId: UserId): boolean {
    return !!openDmPendingByUser[userId];
  }

  function isCloseDmPending(dmId: ChannelId): boolean {
    return !!closeDmPendingById[dmId];
  }

  async function openDmWithUser(userId: UserId, options?: { split?: boolean }): Promise<boolean> {
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
        feedback.flash(userId, "Could not open a direct message with this user.", "error");
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
      feedback.flash(userId, "Could not open a direct message with this user.", "error");
      return false;
    } finally {
      setOpenDmPendingByUser(userId, false);
    }
  }

  async function closeDmConversation(dmId: ChannelId): Promise<boolean> {
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
      feedback.flash(dmId, "Failed to close conversation.", "error");
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
