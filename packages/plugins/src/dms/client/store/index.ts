import { createFlags, service } from "@slock/core/solid";
import type { View } from "@slock/plugins/conversations/client/api/types";
import { defineQuery } from "@slock/plugins/query/client/api";
import { closeDm, fetchChannelMembers, openDm } from "@slock/plugins/slack/client/api";
import type { ChannelId, DirectMessage, User, UserId } from "@slock/types";
import { createMemo, createStore } from "solid-js";
import { isDmId } from "../api";

const feedback = service("feedback");

export function createDmsStore(deps: {
  bootstrap: () => { directMessages: DirectMessage[] } | undefined;
  closeUserProfile: () => void;
  currentUser: () => User | undefined;
  activeView: () => View | null;
  setActiveView: (view: View) => void;
  openInPane: (view: View) => string;
}) {
  const [extraDms, setExtraDms] = createStore<DirectMessage[]>([]);
  const [closedDmIds, setClosedDmFlags] = createStore<Record<ChannelId, boolean>>({});
  const setClosedDmIds = (id: ChannelId, closed: boolean) =>
    setClosedDmFlags((draft) => {
      draft[id] = closed;
    });

  const [dmPatches, setDmPatches] = createStore<Record<ChannelId, Partial<DirectMessage>>>({});
  const openPending = createFlags<UserId>();
  const closePending = createFlags<ChannelId>();

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
    setDmPatches((draft) => {
      draft[id] = { ...draft[id], ...patch };
    });
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
    setExtraDms((list) => {
      list.push({ id: channelId, unread: true, userId });
    });
  }

  const mpdmMembers = defineQuery<ChannelId, true>({
    load: async (channelId) => {
      const { members } = await fetchChannelMembers(channelId, "everyone");
      const selfId = deps.currentUser()?.id;
      const memberIds = members.map((u) => u.id).filter((id) => id !== selfId);
      setExtraDms((list) => {
        list.push({ id: channelId, memberIds, unread: false });
      });
      return true;
    },
    name: "mpdmMembers",
  });

  async function ensureMpdm(channelId: ChannelId) {
    if (baseDmsById().has(channelId)) return;
    await mpdmMembers.ensure(channelId);
  }

  const isOpenDmPending = openPending.has;

  const isCloseDmPending = closePending.has;

  async function openDmWithUser(userId: UserId, options?: { split?: boolean }): Promise<boolean> {
    if (isOpenDmPending(userId)) return false;
    openPending.set(userId, true);
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
        setExtraDms((list) => {
          if (!list.some((dm) => dm.id === channelId))
            list.push({ id: channelId, unread: false, userId });
        });
      openView({ id: channelId, kind: "dm" });
      deps.closeUserProfile();
      return true;
    } catch (err) {
      console.error("Failed to open direct message", err);
      feedback.flash(userId, "Could not open a direct message with this user.", "error");
      return false;
    } finally {
      openPending.set(userId, false);
    }
  }

  async function closeDmConversation(dmId: ChannelId): Promise<boolean> {
    if (isCloseDmPending(dmId)) return false;
    closePending.set(dmId, true);
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
      closePending.set(dmId, false);
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
