import type { DirectMessage } from "@slock/slack-api";
import { openDm } from "@slock/slack-api";
import { createEffect, createMemo, onCleanup } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { actionFeedback } from "../feedback";
import type { View } from "../types";

const DM_AUTO_CLOSE_MS = 7 * 24 * 60 * 60 * 1000;

export function createDmsSlice(deps: {
  bootstrap: () => { directMessages: DirectMessage[] } | undefined;
  closeUserProfile: () => void;
  unreadChannelIds: Record<string, boolean>;
  activeView: () => View | null;
  setActiveView: (view: View) => void;
}) {
  const [extraDms, setExtraDms] = createStore<DirectMessage[]>([]);
  const [closedDmIds, setClosedDmIds] = createStore<Record<string, boolean>>({});
  const [dmLastActivity, setDmLastActivity] = createStore<Record<string, number>>({});
  let dmActivitySeeded = false;
  let autoCloseTimer: ReturnType<typeof setInterval> | null = null;

  // All known DMs regardless of local close state, so reopening/lookups can still find them.
  const allDirectMessages = createMemo<DirectMessage[]>(() => {
    const base = deps.bootstrap()?.directMessages ?? [];
    const extra = extraDms.filter((dm) => !base.some((b) => b.id === dm.id));
    return [...base, ...extra];
  });

  const directMessages = createMemo<DirectMessage[]>(() =>
    allDirectMessages().filter((dm) => !closedDmIds[dm.id]),
  );

  // Mirrors Slack's own "dormant" DM cleanup: a DM nobody has touched in a week
  // quietly closes itself (still reachable again via compose/search) so the
  // sidebar doesn't accumulate every one-off conversation forever.
  function autoCloseInactiveDms() {
    const now = Date.now();
    const view = deps.activeView();
    for (const dm of directMessages()) {
      if (view?.kind === "dm" && view.id === dm.id) continue;
      if (deps.unreadChannelIds[dm.id]) continue;
      const last = dmLastActivity[dm.id];
      if (!last || now - last < DM_AUTO_CLOSE_MS) continue;
      closeDmConversation(dm.id);
    }
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

  async function openDmWithUser(userId: string) {
    const existing = allDirectMessages().find((d) => d.userId === userId);
    if (existing && !closedDmIds[existing.id]) {
      deps.setActiveView({ id: existing.id, kind: "dm" });
      deps.closeUserProfile();
      return;
    }
    const channelId = await openDm(userId);
    if (!channelId) {
      actionFeedback.flash(userId, "Could not open a direct message with this user.", "error");
      return;
    }
    if (existing) setClosedDmIds(channelId, false);
    else setExtraDms(produce((list) => list.push({ id: channelId, unread: false, userId })));
    deps.setActiveView({ id: channelId, kind: "dm" });
    deps.closeUserProfile();
  }

  function closeDmConversation(dmId: string) {
    setClosedDmIds(dmId, true);
    const view = deps.activeView();
    if (view?.kind === "dm" && view.id === dmId) {
      const next = directMessages().find((d) => d.id !== dmId);
      if (next) deps.setActiveView({ id: next.id, kind: "dm" });
    }
  }

  return {
    allDirectMessages,
    closeDmConversation,
    closedDmIds,
    directMessages,
    dmById,
    dmIdForUser,
    openDmWithUser,
    setClosedDmIds,
    setDmLastActivity,
  };
}
