import { createFlags, service } from "@slock/core/solid";
import type { View } from "@slock/plugins/conversations/client/api/types";
import { defineMutation } from "@slock/plugins/query/client/api";
import { openDm } from "@slock/plugins/slack/client/api/channels";
import { mapChannel, parseChannelId } from "@slock/slack";
import type { Channel, ChannelId, DirectMessage, RawChannel, User, UserId } from "@slock/types";
import { createMemo, createStore } from "solid-js";
import { isDmId } from "../api";
import { closeDm } from "../requests";
import { createGroupDms } from "./groupDms";

const feedback = service("feedback");

export function createDmsStore(deps: {
  addJoinedChannel: (channel: Channel) => void;
  bootstrap: () => { directMessages: DirectMessage[] } | undefined;
  closeUserProfile: () => void;
  currentUser: () => User | undefined;
  activeView: () => View | null;
  setActiveView: (view: View) => void;
  showAsChannel: (id: ChannelId) => void;
  openInPane: (view: View) => string;
}) {
  const [extraDms, setExtraDms] = createStore<DirectMessage[]>([]);
  const [closedDmIds, setClosedDmFlags] = createStore<Record<ChannelId, boolean>>({});
  const setClosedDmIds = (id: ChannelId, closed: boolean) =>
    setClosedDmFlags((draft) => {
      draft[id] = closed;
    });

  const [dmPatches, setDmPatches] = createStore<Record<ChannelId, Partial<DirectMessage>>>({});
  const promoted = createFlags<ChannelId>();

  const baseDmsById = createMemo(() => {
    const base = deps.bootstrap()?.directMessages ?? [];
    const extra = extraDms.filter((dm) => !base.some((b) => b.id === dm.id));
    const all = [...base, ...extra].filter((dm) => !promoted.has(dm.id));
    return new Map(all.map((dm) => [dm.id, dm]));
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

  const addExtraDm = (dm: DirectMessage) =>
    setExtraDms((list) => {
      if (!list.some((other) => other.id === dm.id)) list.push(dm);
    });

  function ensureDm(channelId: ChannelId, userId: UserId) {
    if (!baseDmsById().has(channelId)) addExtraDm({ id: channelId, unread: true, userId });
  }

  function isGroupDm(id: ChannelId): boolean {
    return !!dmById(id)?.memberIds;
  }

  function promoteToChannel(raw: RawChannel) {
    const id = parseChannelId(raw.id);
    deps.addJoinedChannel(mapChannel(raw));
    promoted.set(id, true);
    deps.showAsChannel(id);
  }

  const groupDms = createGroupDms({
    currentUserId: () => deps.currentUser()?.id,
    isKnown: (id) => baseDmsById().has(id),
    promoteToChannel,
    upsert: (group) => {
      if (baseDmsById().has(group.id)) patchDm(group.id, group);
      else addExtraDm({ ...group, unread: false });
    },
  });

  function showDm(id: ChannelId, split?: boolean) {
    const view: View = { id, kind: "dm" };
    if (split) deps.openInPane(view);
    else deps.setActiveView(view);
    deps.closeUserProfile();
  }

  const opening = defineMutation<{ split?: boolean; userId: UserId }, ChannelId>({
    key: ({ userId }) => userId,
    mode: "single",
    onError: (error, { userId }) => {
      console.error("Failed to open direct message", error);
      feedback.flash(userId, "Could not open a direct message with this user.", "error");
    },
    onSuccess: (id, { split, userId }) => {
      setClosedDmIds(id, false);
      addExtraDm({ id, unread: false, userId });
      showDm(id, split);
    },
    run: async ({ userId }) => {
      const channelId = await openDm(userId);
      if (!channelId) throw new Error("conversations.open failed");
      return channelId;
    },
  });

  function openDmWithUser(userId: UserId, options?: { split?: boolean }): Promise<boolean> {
    const existing = dmsByUserId().get(userId);
    if (existing && !closedDmIds[existing.id]) {
      showDm(existing.id, options?.split);
      return Promise.resolve(true);
    }
    return opening.run({ split: options?.split, userId });
  }

  const closing = defineMutation<ChannelId, unknown>({
    key: (dmId) => dmId,
    mode: "single",
    onError: (error, dmId) => {
      console.error("Failed to close direct message", error);
      feedback.flash(dmId, "Failed to close conversation.", "error");
    },
    onSuccess: (_reply, dmId) => {
      setClosedDmIds(dmId, true);
      const view = deps.activeView();
      if (view?.kind !== "dm" || view.id !== dmId) return;
      const next = directMessages().find((d) => d.id !== dmId);
      if (next) deps.setActiveView({ id: next.id, kind: "dm" });
    },
    run: closeDm,
  });

  return {
    addGroupDmPeople: groupDms.addPeople,
    allDirectMessages,
    closeDmConversation: (dmId: ChannelId) => closing.run(dmId),
    closedDmIds,
    conversationKind,
    directMessages,
    dmById,
    dmIdForUser,
    ensureDm,
    ensureMpdm: groupDms.ensure,
    isCloseDmPending: (dmId: ChannelId) => closing.pending(dmId),
    isGroupDm,
    isOpenDmPending: (userId: UserId) => opening.pending(userId),
    openDmWithUser,
    patchDm,
    refreshGroupDm: groupDms.refresh,
    setClosedDmIds,
  };
}
