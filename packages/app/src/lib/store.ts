import type {
  ActivityItem,
  BrowsableChannel,
  CanvasInfo,
  Channel,
  DirectMessage,
  Message,
  SavedItem,
  User,
} from "@slock/slack-api";
import {
  addReminder,
  createSection as apiCreateSection,
  deleteSection as apiDeleteSection,
  renameSection as apiRenameSection,
  setPresence as apiSetPresence,
  setStatus as apiSetStatus,
  updateSectionChannels as apiUpdateSectionChannels,
  closeDm,
  createChannel,
  createChannelCanvas,
  deleteMessage,
  editMessage,
  endDndSnooze,
  fetchBootstrap,
  fetchBrowsableChannels,
  fetchCanvas,
  fetchHistory,
  fetchMentions,
  fetchPinnedMessages,
  fetchPins,
  fetchProfileFieldDefs,
  fetchReplies,
  fetchSaved,
  fetchSections,
  fetchUser,
  fetchUserPrefs,
  getPermalink,
  joinChannel,
  leaveChannel,
  mapMessage,
  markChannelRead,
  openDm,
  type PinnedMessage,
  postMessage,
  runSlashCommand,
  saveCanvas,
  searchDirectory,
  setChannelTopic,
  setDndSnooze,
  setMutedChannels,
  togglePin,
  toggleReaction,
  toggleSaved,
  toggleStar,
} from "@slock/slack-api";
import { showToast } from "@slock/ui";
import {
  createEffect,
  createMemo,
  createResource,
  createRoot,
  createSignal,
  onCleanup,
} from "solid-js";
import { createStore, produce, reconcile } from "solid-js/store";
import { EMPTY_FILTERS, type SearchFilters } from "./searchQuery";

export type Nav = "home" | "activity" | "later" | "search";
export type View = { kind: "channel"; id: string } | { kind: "dm"; id: string };
export type ThreadRef = { channelId: string; ts: string };
// Where a given Message lives in the store, so actions (edit/delete/react) can
// patch the right list — a message can appear in a channel's history and/or a thread's replies.
export type MessageLocation = { store: "channel"; key: string } | { store: "thread"; key: string };

function mergeMessages(existing: Message[], fresh: Message[]): Message[] {
  const freshById = new Map(fresh.map((m) => [m.id, m]));
  const pendingOnly = existing.filter((m) => m.id.startsWith("pending-") && !freshById.has(m.id));
  const merged = [...fresh, ...pendingOnly];
  merged.sort(
    (a, b) => parseFloat(a.ts || "0") - parseFloat(b.ts || "0") || (a.id < b.id ? -1 : 1),
  );
  return merged;
}

function wsUrl() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  // Vite's dev-server proxy can't relay the /ws upgrade (its bundled http-proxy
  // never completes the handshake), so in dev we connect straight to the backend
  // port instead of going through the proxy. Plain HTTP proxying (/api) is unaffected.
  const host = import.meta.env.DEV ? `${location.hostname}:5174` : location.host;
  return `${proto}://${host}/ws`;
}

// A small frequency+recency ("frecency") usage tracker, persisted to
// localStorage — the same local-usage-database approach the real client uses
// (for its quick-switcher jump list, its emoji picker, etc.), seeded on top of
// the account's *real* usage history pulled from users.prefs.get (see
// fetchUserPrefs) so ranking isn't cold on a fresh browser/profile.
const FRECENCY_HALF_LIFE_MS = 3 * 24 * 60 * 60 * 1000;

function decayScore(count: number, lastTs: number): number {
  return count * 0.5 ** ((Date.now() - lastTs) / FRECENCY_HALF_LIFE_MS);
}

function createFrecencyTracker(storageKey: string) {
  const load = (): Record<string, { count: number; lastTs: number }> => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? "{}");
    } catch {
      return {};
    }
  };
  const data = load();
  return {
    record(id: string) {
      const entry = data[id];
      data[id] = { count: (entry?.count ?? 0) + 1, lastTs: Date.now() };
      localStorage.setItem(storageKey, JSON.stringify(data));
    },
    score(id: string): number {
      const entry = data[id];
      return entry ? decayScore(entry.count, entry.lastTs) : 0;
    },
  };
}

function setup() {
  const [bootstrap] = createResource(fetchBootstrap);
  const [sections, { refetch: refetchSections }] = createResource(fetchSections);

  async function createChannelSection(name: string): Promise<{ id: string; name: string } | null> {
    const created = await apiCreateSection(name);
    if (!created) {
      showToast("Failed to create section.");
      return null;
    }
    await refetchSections();
    showToast(`Created section "${created.name}".`);
    return created;
  }

  async function renameChannelSection(sectionId: string, name: string) {
    const ok = await apiRenameSection(sectionId, name);
    if (!ok) {
      showToast("Failed to rename section.");
      return;
    }
    await refetchSections();
  }

  async function deleteChannelSection(sectionId: string) {
    const ok = await apiDeleteSection(sectionId);
    if (!ok) {
      showToast("Failed to delete section.");
      return;
    }
    await refetchSections();
    showToast("Section deleted.");
  }

  // Slack's bulkUpdate is scoped to one section at a time, so moving a channel
  // between two custom sections is a remove-then-insert pair rather than one call.
  async function moveChannelToSection(channelId: string, targetSectionId: string | null) {
    const current = sections() ?? [];
    const from = current.find((s) => s.channelIds.includes(channelId) && s.id !== targetSectionId);
    if (from) {
      const ok = await apiUpdateSectionChannels(from.id, { removeChannelIds: [channelId] });
      if (!ok) {
        showToast("Failed to move channel.");
        return;
      }
    }
    if (targetSectionId) {
      const ok = await apiUpdateSectionChannels(targetSectionId, { insertChannelIds: [channelId] });
      if (!ok) {
        showToast("Failed to move channel.");
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
    showToast(targetSectionId ? "Moved to section." : "Removed from section.");
  }
  const [profileFieldDefs] = createResource(fetchProfileFieldDefs);
  const [selected, setSelected] = createSignal<View | null>(null);
  const [nav, setNav] = createSignal<Nav>("home");
  const [searchScreenQuery, setSearchScreenQuery] = createSignal("");
  const [searchScreenFilters, setSearchScreenFilters] = createSignal<SearchFilters>(EMPTY_FILTERS);
  const [messagesByChannel, setMessagesByChannel] = createStore<Record<string, Message[]>>({});
  const loadedChannels = new Set<string>();
  const [extraUsers, setExtraUsers] = createStore<Record<string, User>>({});
  const pendingUsers = new Set<string>();
  const [presenceOverrides, setPresenceOverrides] = createStore<Record<string, "active" | "away">>(
    {},
  );
  const [extraDms, setExtraDms] = createStore<DirectMessage[]>([]);
  const [extraChannels, setExtraChannels] = createStore<Channel[]>([]);
  const [unreadChannelIds, setUnreadChannelIds] = createStore<Record<string, boolean>>({});
  const [starredChannelIds, setStarredChannelIds] = createStore<Record<string, boolean>>({});
  let starredSeeded = false;
  const [leftChannelIds, setLeftChannelIds] = createStore<Record<string, boolean>>({});
  const [closedDmIds, setClosedDmIds] = createStore<Record<string, boolean>>({});
  const [dmLastActivity, setDmLastActivity] = createStore<Record<string, number>>({});
  let dmActivitySeeded = false;
  let autoCloseTimer: ReturnType<typeof setInterval> | null = null;
  const DM_AUTO_CLOSE_MS = 7 * 24 * 60 * 60 * 1000;

  const [activeThread, setActiveThread] = createSignal<ThreadRef | null>(null);
  const [threadMessages, setThreadMessages] = createStore<Record<string, Message[]>>({});
  const loadedThreads = new Set<string>();

  const [profileUserId, setProfileUserId] = createSignal<string | null>(null);
  const [rtmConnected, setRtmConnected] = createSignal(false);

  const [activityItems, setActivityItems] = createStore<ActivityItem[]>([]);
  const [activityLoaded, setActivityLoaded] = createSignal(false);
  const [lastActivityReadAt, setLastActivityReadAt] = createSignal(
    Number(localStorage.getItem("slock-activity-read-at") ?? 0),
  );

  const [laterItems, setLaterItems] = createStore<SavedItem[]>([]);
  const [laterLoaded, setLaterLoaded] = createSignal(false);
  const [laterMessages, setLaterMessages] = createStore<Record<string, Message | null>>({});

  const [pinnedByChannel, setPinnedByChannel] = createStore<
    Record<string, Record<string, boolean>>
  >({});
  const loadedPins = new Set<string>();
  const [pinnedMessagesCache, setPinnedMessagesCache] = createStore<
    Record<string, PinnedMessage[]>
  >({});
  const [pinnedPanelChannelId, setPinnedPanelChannelId] = createSignal<string | null>(null);

  const [browsableChannels, setBrowsableChannels] = createSignal<BrowsableChannel[]>([]);
  const [browsingChannels, setBrowsingChannelsOpen] = createSignal(false);

  const [selfStatusOverride, setSelfStatusOverride] = createSignal<Partial<User> | null>(null);

  const MUTE_STORAGE_KEY = "slock-muted-channels";
  const loadMuted = (): string[] => {
    try {
      return JSON.parse(localStorage.getItem(MUTE_STORAGE_KEY) ?? "[]");
    } catch {
      return [];
    }
  };
  const [mutedChannelIds, setMutedChannelIds] = createStore<Record<string, boolean>>(
    Object.fromEntries(loadMuted().map((id) => [id, true])),
  );

  const NOTIFY_ALL_STORAGE_KEY = "slock-notify-all-channels";
  const loadNotifyAll = (): string[] => {
    try {
      return JSON.parse(localStorage.getItem(NOTIFY_ALL_STORAGE_KEY) ?? "[]");
    } catch {
      return [];
    }
  };
  const [notifyAllChannelIds, setNotifyAllChannelIds] = createStore<Record<string, boolean>>(
    Object.fromEntries(loadNotifyAll().map((id) => [id, true])),
  );

  const [dndSnoozedUntil, setDndSnoozedUntil] = createSignal<number | null>(
    Number(localStorage.getItem("slock-dnd-until") ?? 0) || null,
  );

  // Mirrors the "frecency" ranking the real client uses for local usage
  // databases (quick-switcher jump targets, emoji picker): each use bumps a
  // count, but the score decays with a few days' half-life so old history
  // doesn't outrank what's actually used today.
  const [userPrefs] = createResource(fetchUserPrefs);

  const jumpFrecency = createFrecencyTracker("slock-frecency");
  const recordVisit = jumpFrecency.record;
  // Real jump-list history from Slack (channels *and* people, both keyed by id)
  // plus this session's local tracker, so a fresh browser profile still ranks
  // by actual usage instead of starting empty.
  function frecencyScore(id: string): number {
    const server = userPrefs()?.channelFrecency[id];
    const serverScore = server ? decayScore(server.count, server.lastVisit) : 0;
    return serverScore + jumpFrecency.score(id);
  }

  const emojiFrecency = createFrecencyTracker("slock-emoji-frecency");
  const recordEmojiUse = emojiFrecency.record;
  // Real per-emoji usage counts from Slack (no timestamps are given, so no decay)
  // plus this session's local tracker.
  function emojiUseScore(name: string): number {
    const serverScore = userPrefs()?.emojiUse[name] ?? 0;
    return serverScore + emojiFrecency.score(name);
  }

  const [canvasByChannel, setCanvasByChannel] = createStore<Record<string, CanvasInfo | null>>({});
  const [openCanvasChannelId, setOpenCanvasChannelId] = createSignal<string | null>(null);

  // All known DMs regardless of local close state, so reopening/lookups can still find them.
  const allDirectMessages = createMemo<DirectMessage[]>(() => {
    const base = bootstrap()?.directMessages ?? [];
    const extra = extraDms.filter((dm) => !base.some((b) => b.id === dm.id));
    return [...base, ...extra];
  });

  const directMessages = createMemo<DirectMessage[]>(() =>
    allDirectMessages().filter((dm) => !closedDmIds[dm.id]),
  );

  // Channels newly joined/created this session — bootstrap() is a resource
  // snapshot from boot, not a store, so a freshly joined channel needs to be
  // merged in here rather than mutating that snapshot.
  const channels = createMemo<Channel[]>(() => {
    const base = bootstrap()?.channels ?? [];
    const extra = extraChannels.filter((c) => !base.some((b) => b.id === c.id));
    return [...base, ...extra];
  });

  const activeView = createMemo<View | null>(() => {
    const explicit = selected();
    if (explicit) return explicit;
    const data = bootstrap();
    if (!data) return null;
    if (data.channels[0]) return { kind: "channel", id: data.channels[0].id };
    if (data.directMessages[0]) return { kind: "dm", id: data.directMessages[0].id };
    return null;
  });

  function setActiveView(view: View) {
    setActiveThread(null);
    setSelected(view);
    setNav("home");
    setUnreadChannelIds(view.id, false);
    if (view.kind === "dm" && closedDmIds[view.id]) setClosedDmIds(view.id, false);
    const frecencyId =
      view.kind === "dm"
        ? (allDirectMessages().find((d) => d.id === view.id)?.userId ?? view.id)
        : view.id;
    recordVisit(frecencyId);
  }

  function setNavView(next: Nav) {
    setNav(next);
    if (next === "later") ensureLaterLoaded();
    if (next === "activity") ensureActivityLoaded();
  }

  // Opens a channel/message from the Activity or Later list without leaving that
  // tab — nav stays on 'activity'/'later' (so the feed keeps showing in the
  // sidebar) while the main panel switches to the selected channel.
  function openChannelPeek(channelId: string, ts: string) {
    setSelected({ kind: "channel", id: channelId });
    setUnreadChannelIds(channelId, false);
    recordVisit(channelId);
    openThread(channelId, ts);
  }

  function openMessageSearch(query: string, filters: SearchFilters = EMPTY_FILTERS) {
    setSearchScreenQuery(query);
    setSearchScreenFilters(filters);
    setNavView("search");
  }

  // ---- initial per-view loads (the websocket keeps things fresh after this) ----

  createEffect(() => {
    const data = bootstrap();
    if (!data || starredSeeded) return;
    starredSeeded = true;
    for (const id of data.starredChannelIds) setStarredChannelIds(id, true);
  });

  createEffect(() => {
    const data = bootstrap();
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

  createEffect(() => {
    const view = activeView();
    if (view) ensurePinsLoaded(view.id);
  });

  let wasOnActivity = false;
  createEffect(() => {
    const isActivity = nav() === "activity";
    if (wasOnActivity && !isActivity) markActivityRead();
    wasOnActivity = isActivity;
  });

  createEffect(() => {
    const view = activeView();
    if (!view) return;
    if (loadedChannels.has(view.id)) return;
    loadedChannels.add(view.id);
    fetchHistory(view.id)
      .then((messages) => {
        setMessagesByChannel(view.id, messages);
      })
      .catch(() => {
        loadedChannels.delete(view.id);
      });
  });

  createEffect(() => {
    const thread = activeThread();
    if (!thread) return;
    const key = thread.ts;
    if (loadedThreads.has(key)) return;
    loadedThreads.add(key);
    fetchReplies(thread.channelId, thread.ts)
      .then((messages) => {
        setThreadMessages(key, messages);
      })
      .catch(() => {
        loadedThreads.delete(key);
      });
  });

  // ---- realtime: a single persistent socket to our own server, which relays Slack's ----
  // ---- RTM websocket (or, if that's unavailable for this workspace, its own fallback ----
  // ---- poll) — the browser itself never polls on an interval. ----

  let socket: WebSocket | null = null;
  let reconnectDelay = 1000;
  const MAX_RECONNECT_DELAY = 20000;

  function send(payload: unknown) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
  }

  function findMessageList(
    channelId: string,
    ts: string,
  ): { location: MessageLocation; list: Message[] } | null {
    const inChannel = messagesByChannel[channelId];
    if (inChannel?.some((m) => m.ts === ts))
      return { location: { store: "channel", key: channelId }, list: inChannel };
    for (const key of Object.keys(threadMessages)) {
      const list = threadMessages[key];
      if (list?.some((m) => m.ts === ts)) return { location: { store: "thread", key }, list };
    }
    return null;
  }

  function applyReactionEvent(
    channel: string,
    ts: string,
    name: string,
    userId: string,
    added: boolean,
  ) {
    const found = findMessageList(channel, ts);
    if (!found) return;
    const msg = found.list.find((m) => m.ts === ts);
    if (!msg) return;
    const reactions = msg.reactions ?? [];
    const existing = reactions.find((r) => r.name === name);
    let next: typeof reactions;
    if (added) {
      next = existing
        ? reactions.map((r) =>
            r.name === name ? { ...r, count: r.count + 1, users: [...r.users, userId] } : r,
          )
        : [...reactions, { name, count: 1, users: [userId] }];
    } else if (existing) {
      next = reactions
        .map((r) =>
          r.name === name
            ? { ...r, count: r.count - 1, users: r.users.filter((u) => u !== userId) }
            : r,
        )
        .filter((r) => r.count > 0);
    } else {
      next = reactions;
    }
    patchMessage(found.location, ts, { reactions: next });

    const me = currentUser();
    if (added && me && msg.userId === me.id) {
      pushActivity({
        id: `rx-${channel}-${ts}-${name}-${userId}-${Date.now()}`,
        kind: "reaction",
        channelId: channel,
        ts,
        userId,
        text: msg.text,
        time: Date.now(),
        reactionName: name,
      });
    }
  }

  function pushActivity(item: ActivityItem) {
    setActivityItems(
      produce((list) => {
        list.unshift(item);
        if (list.length > 300) list.length = 300;
      }),
    );
  }

  const BROADCAST_RE = /<!(channel|here)>/;
  const SUBTEAM_RE = /<!subteam\^([^|>]+)/;

  // Priority order matters: a direct @mention always wins over the channel's
  // broader notification settings, down to "notify on every post" as the catch-all.
  function classifyIncomingActivity(
    channel: string,
    ts: string,
    msg: Message,
    meId: string,
    threadRelevant: boolean,
  ): ActivityItem | null {
    const text = msg.text ?? "";
    const time = parseFloat(ts) * 1000;
    const base = { channelId: channel, ts, userId: msg.userId, text, time };

    if (text.includes(`<@${meId}>`)) return { ...base, id: `mn-${channel}-${ts}`, kind: "mention" };
    if (directMessages().some((d) => d.id === channel))
      return { ...base, id: `dm-${channel}-${ts}`, kind: "dm" };

    const broadcast = text.match(BROADCAST_RE);
    if (broadcast)
      return {
        ...base,
        id: `cb-${channel}-${ts}`,
        kind: "channel_mention",
        broadcastRange: broadcast[1] as "channel" | "here",
      };

    const subteam = text.match(SUBTEAM_RE);
    if (subteam)
      return {
        ...base,
        id: `ug-${channel}-${ts}`,
        kind: "usergroup_mention",
        usergroupId: subteam[1],
      };

    if (threadRelevant) return { ...base, id: `th-${channel}-${ts}`, kind: "thread_reply" };
    if (notifyAllChannelIds[channel])
      return { ...base, id: `ca-${channel}-${ts}`, kind: "channel_all" };

    return null;
  }

  // Our own sent messages are added optimistically (see sendMessage) under a
  // temporary "pending-*" id/ts before the post resolves. The websocket often
  // echoes that same message back before the post's response arrives, so a
  // plain ts/id dedup check misses it (the pending entry still has the fake
  // client-side ts) and the message would otherwise get appended a second time.
  // Replacing the still-pending entry in place here, and having sendMessage's
  // resolution back off if it sees the real ts already present (below), covers
  // both orderings of that race.
  function mergeIncomingMessage(existing: Message[], msg: Message): Message[] {
    if (existing.some((m) => m.ts === msg.ts || m.id === msg.ts)) return existing;
    const me = currentUser();
    if (me && msg.userId === me.id) {
      const pendingIdx = existing.findIndex(
        (m) => m.id.startsWith("pending-") && m.text === msg.text,
      );
      if (pendingIdx !== -1) {
        const next = existing.slice();
        next[pendingIdx] = msg;
        return next;
      }
    }
    return [...existing, msg];
  }

  function handleIncomingMessage(payload: any) {
    const subtype = payload.subtype;
    const channel = payload.channel;

    if (subtype === "message_changed") {
      const updated = payload.message;
      if (!updated?.ts) return;
      const found = findMessageList(channel, updated.ts);
      if (found)
        patchMessage(found.location, updated.ts, {
          text: updated.text,
          blocks: updated.blocks,
          editedLocally: !!updated.edited,
        });
      return;
    }

    if (subtype === "message_deleted") {
      const ts = payload.deleted_ts;
      if (!ts) return;
      const found = findMessageList(channel, ts);
      // Slack removes deleted messages outright; we keep the row as a red
      // tombstone instead so the conversation doesn't silently reshuffle.
      if (found) patchMessage(found.location, ts, { deleted: true });
      return;
    }

    const ts = payload.ts;
    if (!ts) return;
    const msg = mapMessage(payload);
    const me = currentUser();
    const isThreadReply = !!payload.thread_ts && payload.thread_ts !== ts;
    let threadRelevant = false;

    if (isThreadReply) {
      if (loadedThreads.has(payload.thread_ts)) {
        setThreadMessages(payload.thread_ts, (existing = []) =>
          mergeIncomingMessage(existing, msg),
        );
      }
      const parent = findMessageList(channel, payload.thread_ts);
      const parentMsg = parent?.list.find((m) => m.ts === payload.thread_ts);
      if (parent && parentMsg) {
        patchMessage(parent.location, payload.thread_ts, {
          replyCount: (parentMsg.replyCount ?? 0) + 1,
        });
        if (me && parentMsg.userId === me.id) threadRelevant = true;
      }
      if (
        me &&
        !threadRelevant &&
        threadMessages[payload.thread_ts]?.some((m) => m.userId === me.id)
      )
        threadRelevant = true;
    } else if (loadedChannels.has(channel)) {
      setMessagesByChannel(channel, (existing = []) => mergeIncomingMessage(existing, msg));
    }

    const activeId = activeView()?.id;
    if (channel !== activeId) setUnreadChannelIds(channel, true);

    if (allDirectMessages().some((d) => d.id === channel)) {
      setDmLastActivity(channel, Date.now());
      // A new message on a DM the user closed means it's active again.
      if (closedDmIds[channel]) setClosedDmIds(channel, false);
    }

    if (me && msg.userId !== me.id) {
      const activity = classifyIncomingActivity(channel, ts, msg, me.id, threadRelevant);
      if (activity) pushActivity(activity);
    }
  }

  function connectSocket() {
    socket = new WebSocket(wsUrl());

    socket.addEventListener("open", () => {
      reconnectDelay = 1000;
      for (const channel of loadedChannels) send({ type: "watch_channel", channel });
      const thread = activeThread();
      if (thread) send({ type: "watch_thread", channel: thread.channelId, ts: thread.ts });
    });

    socket.addEventListener("message", (event) => {
      let payload: any;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (payload.type) {
        case "_status":
          setRtmConnected(!!payload.connected);
          break;
        case "_history_snapshot":
          if (loadedChannels.has(payload.channel)) {
            const fresh = (payload.messages ?? [])
              .filter((m: any) => m.type === "message" && !m.subtype)
              .map(mapMessage)
              .reverse();
            setMessagesByChannel(payload.channel, (existing: Message[] = []) =>
              mergeMessages(existing, fresh),
            );
          }
          break;
        case "_replies_snapshot":
          if (loadedThreads.has(payload.ts)) {
            const fresh = (payload.messages ?? [])
              .filter((m: any) => m.type === "message")
              .map(mapMessage);
            setThreadMessages(payload.ts, (existing: Message[] = []) =>
              mergeMessages(existing, fresh),
            );
          }
          break;
        case "message":
          handleIncomingMessage(payload);
          break;
        case "reaction_added":
        case "reaction_removed":
          // Our own reacts/unreacts are already applied optimistically in
          // reactToMessage — the gateway echoes them back over the socket like
          // any other client's, so re-applying here double-counted them.
          if (payload.item?.channel && payload.item?.ts && payload.user !== currentUser()?.id) {
            applyReactionEvent(
              payload.item.channel,
              payload.item.ts,
              payload.reaction,
              payload.user,
              payload.type === "reaction_added",
            );
          }
          break;
        case "presence_change": {
          const presence = payload.presence === "away" ? "away" : "active";
          const ids: string[] = payload.users ?? (payload.user ? [payload.user] : []);
          for (const id of ids) setPresenceOverrides(id, presence);
          break;
        }
        default:
          break;
      }
    });

    const reconnect = () => {
      socket = null;
      setTimeout(connectSocket, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 1.7, MAX_RECONNECT_DELAY);
    };
    socket.addEventListener("close", reconnect);
    socket.addEventListener("error", () => socket?.close());
  }

  connectSocket();
  onCleanup(() => socket?.close());

  createEffect(() => {
    const view = activeView();
    if (view) send({ type: "watch_channel", channel: view.id });
  });

  createEffect(() => {
    const thread = activeThread();
    if (thread) send({ type: "watch_thread", channel: thread.channelId, ts: thread.ts });
  });

  function userById(id: string): User | undefined {
    const known = bootstrap()?.users.find((u) => u.id === id) ?? extraUsers[id];
    if (!known) {
      if (!pendingUsers.has(id)) {
        pendingUsers.add(id);
        fetchUser(id)
          .then((user) => {
            if (user) setExtraUsers(id, user);
          })
          .catch(() => {
            pendingUsers.delete(id);
          });
      }
      return undefined;
    }
    const presence = presenceOverrides[id];
    return presence ? { ...known, presence } : known;
  }

  // Org-wide people search for DM compose / @mention / global search. The bootstrap
  // user list is capped at 200 for payload size, which on a large workspace (Hack
  // Club's is ~100k members) covers a sliver of the org — searching only that slice
  // would silently fail to find almost anyone. This merges instantly-available local
  // matches (bootstrap + anyone already resolved via userById) with the server's
  // continuously-syncing directory cache (see server/index.ts).
  async function searchUsers(query: string, excludeId?: string): Promise<User[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const local = new Map<string, User>();
    for (const u of bootstrap()?.users ?? []) local.set(u.id, u);
    for (const id of Object.keys(extraUsers)) local.set(id, extraUsers[id]);
    const localMatches = [...local.values()].filter(
      (u) => u.id !== excludeId && u.name.toLowerCase().includes(q),
    );

    const { users: remote } = await searchDirectory(q);
    for (const u of remote) {
      if (!local.has(u.id)) setExtraUsers(u.id, u);
    }

    const merged = new Map<string, User>();
    for (const u of localMatches) merged.set(u.id, u);
    for (const u of remote) if (u.id !== excludeId) merged.set(u.id, u);
    return [...merged.values()].slice(0, 40);
  }

  function channelById(id: string): Channel | undefined {
    return channels().find((c) => c.id === id);
  }

  function dmById(id: string): DirectMessage | undefined {
    return allDirectMessages().find((d) => d.id === id);
  }

  function dmIdForUser(userId: string): string | undefined {
    return allDirectMessages().find((d) => d.userId === userId)?.id;
  }

  function currentUser(): User | undefined {
    const base = bootstrap()?.currentUser;
    if (!base) return base;
    const presence = presenceOverrides[base.id];
    const status = selfStatusOverride();
    if (!presence && !status) return base;
    return { ...base, ...(presence ? { presence } : {}), ...(status ?? {}) };
  }

  function openThread(channelId: string, ts: string) {
    setActiveThread({ channelId, ts });
  }

  function closeThread() {
    const thread = activeThread();
    if (thread) send({ type: "unwatch_thread", ts: thread.ts });
    setActiveThread(null);
  }

  function openUserProfile(id: string) {
    setProfileUserId(id);
  }

  function closeUserProfile() {
    setProfileUserId(null);
  }

  async function openDmWithUser(userId: string) {
    const existing = allDirectMessages().find((d) => d.userId === userId);
    if (existing && !closedDmIds[existing.id]) {
      setActiveView({ kind: "dm", id: existing.id });
      closeUserProfile();
      return;
    }
    const channelId = await openDm(userId);
    if (!channelId) {
      showToast("Could not open a direct message with this user.");
      return;
    }
    if (existing) setClosedDmIds(channelId, false);
    else setExtraDms(produce((list) => list.push({ id: channelId, userId, unread: false })));
    setActiveView({ kind: "dm", id: channelId });
    closeUserProfile();
  }

  async function closeDmConversation(dmId: string) {
    setClosedDmIds(dmId, true);
    const view = activeView();
    if (view?.kind === "dm" && view.id === dmId) {
      const next = directMessages().find((d) => d.id !== dmId);
      if (next) setActiveView({ kind: "dm", id: next.id });
    }
    try {
      await closeDm(dmId);
    } catch (err) {
      console.error("Failed to close DM", err);
      showToast("Failed to close conversation.");
      setClosedDmIds(dmId, false);
    }
  }

  // Mirrors Slack's own "dormant" DM cleanup: a DM nobody has touched in a week
  // quietly closes itself (still reachable again via compose/search) so the
  // sidebar doesn't accumulate every one-off conversation forever.
  function autoCloseInactiveDms() {
    const now = Date.now();
    const view = activeView();
    for (const dm of directMessages()) {
      if (view?.kind === "dm" && view.id === dm.id) continue;
      if (unreadChannelIds[dm.id]) continue;
      const last = dmLastActivity[dm.id];
      if (!last || now - last < DM_AUTO_CLOSE_MS) continue;
      closeDmConversation(dm.id);
    }
  }

  function patchMessage(location: MessageLocation, ts: string, patch: Partial<Message>) {
    if (location.store === "channel") {
      setMessagesByChannel(
        location.key,
        produce((list) => {
          const msg = list.find((m) => m.ts === ts);
          if (msg) Object.assign(msg, patch);
        }),
      );
    } else {
      setThreadMessages(
        location.key,
        produce((list) => {
          const msg = list.find((m) => m.ts === ts);
          if (msg) Object.assign(msg, patch);
        }),
      );
    }
  }

  function removeMessage(location: MessageLocation, ts: string) {
    const remove = (list: Message[]) => {
      const idx = list.findIndex((m) => m.ts === ts);
      if (idx !== -1) list.splice(idx, 1);
    };
    if (location.store === "channel") {
      setMessagesByChannel(location.key, produce(remove));
    } else {
      setThreadMessages(location.key, produce(remove));
    }
  }

  async function editMessageText(
    location: MessageLocation,
    channelId: string,
    ts: string,
    text: string,
  ) {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      await editMessage(channelId, ts, trimmed);
      patchMessage(location, ts, { text: trimmed, editedLocally: true });
    } catch (err) {
      console.error("Failed to edit message", err);
      showToast("Failed to edit message.");
    }
  }

  async function deleteMessageAt(location: MessageLocation, channelId: string, ts: string) {
    try {
      await deleteMessage(channelId, ts);
      patchMessage(location, ts, { deleted: true });
    } catch (err) {
      console.error("Failed to delete message", err);
      showToast("Failed to delete message.");
    }
  }

  async function reactToMessage(
    location: MessageLocation,
    channelId: string,
    msg: Message,
    emojiName: string,
  ) {
    const me = currentUser();
    if (!me) return;
    const previousReactions = msg.reactions;
    const reactions = previousReactions ?? [];
    const existing = reactions.find((r) => r.name === emojiName);
    const alreadyReacted = !!existing?.users.includes(me.id);

    let nextReactions: typeof reactions;
    if (alreadyReacted) {
      nextReactions = reactions
        .map((r) =>
          r.name === emojiName
            ? { ...r, count: r.count - 1, users: r.users.filter((u) => u !== me.id) }
            : r,
        )
        .filter((r) => r.count > 0);
    } else if (existing) {
      nextReactions = reactions.map((r) =>
        r.name === emojiName ? { ...r, count: r.count + 1, users: [...r.users, me.id] } : r,
      );
    } else {
      nextReactions = [...reactions, { name: emojiName, count: 1, users: [me.id] }];
    }
    patchMessage(location, msg.ts, { reactions: nextReactions });
    try {
      await toggleReaction(channelId, msg.ts, emojiName, alreadyReacted);
    } catch (err) {
      console.error("Failed to toggle reaction", err);
      patchMessage(location, msg.ts, { reactions: previousReactions });
    }
  }

  function isSavedForLater(ts: string): boolean {
    return laterItems.some((i) => i.ts === ts);
  }

  async function toggleSaveForLater(channelId: string, ts: string) {
    const currentlySaved = isSavedForLater(ts);
    if (currentlySaved) {
      setLaterItems((list) => list.filter((i) => i.ts !== ts));
    } else {
      setLaterItems(produce((list) => list.push({ channelId, ts })));
    }
    try {
      await toggleSaved(channelId, ts, currentlySaved);
    } catch (err) {
      console.error("Failed to toggle saved-for-later", err);
      showToast("Failed to update Later.");
      if (currentlySaved) setLaterItems(produce((list) => list.push({ channelId, ts })));
      else setLaterItems((list) => list.filter((i) => i.ts !== ts));
    }
  }

  async function ensureLaterLoaded() {
    if (laterLoaded()) return;
    setLaterLoaded(true);
    try {
      const items = await fetchSaved();
      setLaterItems(reconcile(items));
      for (const item of items) {
        fetchHistory(item.channelId).catch(() => []); // warms channel name/topic cache lookups
      }
    } catch {
      setLaterLoaded(false);
    }
  }

  async function ensureLaterMessageLoaded(item: SavedItem) {
    const key = `${item.channelId}:${item.ts}`;
    if (key in laterMessages) return;
    try {
      const replies = await fetchReplies(item.channelId, item.ts);
      const msg = replies.find((m) => m.ts === item.ts);
      setLaterMessages(key, msg ?? null);
    } catch {
      setLaterMessages(key, null);
    }
  }

  async function ensureActivityLoaded() {
    if (activityLoaded()) return;
    setActivityLoaded(true);
    const me = currentUser();
    if (!me) {
      setActivityLoaded(false);
      return;
    }
    try {
      const items = await fetchMentions(me.id);
      setActivityItems(
        produce((list) => {
          const seen = new Set(list.map((i) => i.id));
          for (const item of items) if (!seen.has(item.id)) list.push(item);
          list.sort((a, b) => b.time - a.time);
        }),
      );
    } catch {
      // search endpoint may not be available on every workspace; live events still populate this list
    }
  }

  const unreadActivityCount = createMemo(
    () => activityItems.filter((i) => i.time > lastActivityReadAt()).length,
  );

  // Bell states, from most to least urgent: a red dot for things addressed
  // straight at the user (direct pings, DMs), a plain glow for activity that's
  // relevant but not personally directed (thread replies, @channel/@here/usergroup
  // pings, channels set to notify on every post), and nothing at all for reactions.
  const PING_KINDS = new Set(["mention", "dm"]);
  const GLOW_KINDS = new Set([
    "thread_reply",
    "channel_mention",
    "usergroup_mention",
    "channel_all",
  ]);

  const hasUnreadPing = createMemo(() =>
    activityItems.some((i) => PING_KINDS.has(i.kind) && i.time > lastActivityReadAt()),
  );
  const hasUnreadGlow = createMemo(() =>
    activityItems.some((i) => GLOW_KINDS.has(i.kind) && i.time > lastActivityReadAt()),
  );

  function markActivityRead() {
    const latest = activityItems.reduce((max, i) => Math.max(max, i.time), 0);
    const next = Math.max(latest, Date.now());
    setLastActivityReadAt(next);
    localStorage.setItem("slock-activity-read-at", String(next));
  }

  async function ensurePinsLoaded(channelId: string) {
    if (loadedPins.has(channelId)) return;
    loadedPins.add(channelId);
    try {
      const pins = await fetchPins(channelId);
      const map: Record<string, boolean> = {};
      for (const ts of pins) map[ts] = true;
      setPinnedByChannel(channelId, map);
    } catch {
      loadedPins.delete(channelId);
    }
  }

  function isMessagePinned(channelId: string, ts: string): boolean {
    return !!pinnedByChannel[channelId]?.[ts];
  }

  async function togglePinMessage(channelId: string, ts: string) {
    const currentlyPinned = isMessagePinned(channelId, ts);
    if (!pinnedByChannel[channelId]) setPinnedByChannel(channelId, {});
    setPinnedByChannel(channelId, ts, !currentlyPinned);
    try {
      await togglePin(channelId, ts, currentlyPinned);
      showToast(currentlyPinned ? "Unpinned from channel." : "Pinned to channel.");
    } catch (err) {
      console.error("Failed to toggle pin", err);
      showToast("Failed to update pin.");
      setPinnedByChannel(channelId, ts, currentlyPinned);
    }
  }

  async function copyMessageLink(channelId: string, ts: string) {
    try {
      const link = await getPermalink(channelId, ts);
      if (!link) throw new Error("no permalink");
      await navigator.clipboard.writeText(link);
      showToast("Link copied to clipboard.");
    } catch (err) {
      console.error("Failed to get permalink", err);
      showToast("Failed to copy link.");
    }
  }

  function markMessageUnread(channelId: string, ts: string) {
    const list = messagesByChannel[channelId] ?? [];
    const idx = list.findIndex((m) => m.ts === ts);
    const previousTs = idx > 0 ? list[idx - 1].ts : "0";
    markChannelRead(channelId, previousTs)
      .then(() => {
        setUnreadChannelIds(channelId, true);
        showToast("Marked as unread.");
      })
      .catch(() => showToast("Failed to mark as unread."));
  }

  const REMINDER_OPTIONS: { label: string; time: string }[] = [
    { label: "in 20 minutes", time: "in 20 minutes" },
    { label: "in 1 hour", time: "in 1 hour" },
    { label: "in 3 hours", time: "in 3 hours" },
    { label: "tomorrow", time: "tomorrow at 9am" },
    { label: "next week", time: "next monday at 9am" },
  ];

  async function remindAboutMessage(channelId: string, ts: string, time: string) {
    try {
      const link = await getPermalink(channelId, ts);
      await addReminder(link ?? `message ${ts} in ${channelId}`, time);
      showToast("I'll remind you about this.");
    } catch (err) {
      console.error("Failed to set reminder", err);
      showToast("Failed to set reminder.");
    }
  }

  // ---- pinned items panel ----

  function openPinnedPanel(channelId: string) {
    setPinnedPanelChannelId(channelId);
    ensurePinnedMessagesLoaded(channelId);
  }

  function closePinnedPanel() {
    setPinnedPanelChannelId(null);
  }

  async function ensurePinnedMessagesLoaded(channelId: string) {
    try {
      const pins = await fetchPinnedMessages(channelId);
      setPinnedMessagesCache(channelId, pins);
    } catch {
      setPinnedMessagesCache(channelId, []);
    }
  }

  // ---- channel directory: browse / join / create ----

  async function searchBrowsableChannels(query: string) {
    const found = await fetchBrowsableChannels(query);
    setBrowsableChannels(found);
  }

  function openBrowseChannels() {
    setBrowsingChannelsOpen(true);
    searchBrowsableChannels("");
  }

  function closeBrowseChannels() {
    setBrowsingChannelsOpen(false);
  }

  async function joinChannelById(channelId: string) {
    try {
      const channel = await joinChannel(channelId);
      setExtraChannels(produce((list) => list.push(channel)));
      setActiveView({ kind: "channel", id: channel.id });
      closeBrowseChannels();
      showToast(`Joined #${channel.name}.`);
    } catch (err) {
      console.error("Failed to join channel", err);
      showToast("Failed to join channel.");
    }
  }

  async function createNewChannel(name: string, isPrivate: boolean) {
    try {
      const channel = await createChannel(name, isPrivate);
      setExtraChannels(produce((list) => list.push(channel)));
      setActiveView({ kind: "channel", id: channel.id });
      closeBrowseChannels();
      showToast(`Created #${channel.name}.`);
    } catch (err) {
      console.error("Failed to create channel", err);
      showToast(err instanceof Error ? err.message : "Failed to create channel.");
    }
  }

  // ---- own status / presence ----

  async function updateMyStatus(text: string, emoji: string, expiration: number) {
    setSelfStatusOverride({ statusText: text || undefined, statusEmoji: emoji || undefined });
    try {
      await apiSetStatus(text, emoji, expiration);
    } catch (err) {
      console.error("Failed to set status", err);
      showToast("Failed to update status.");
    }
  }

  async function clearMyStatus() {
    await updateMyStatus("", "", 0);
  }

  async function updateMyPresence(presence: "auto" | "away") {
    const me = currentUser();
    if (me) setPresenceOverrides(me.id, presence === "away" ? "away" : "active");
    try {
      await apiSetPresence(presence);
    } catch (err) {
      console.error("Failed to set presence", err);
      showToast("Failed to update presence.");
    }
  }

  // ---- mute channels + Do Not Disturb ----

  function isChannelMuted(channelId: string): boolean {
    return !!mutedChannelIds[channelId];
  }

  function toggleMuteChannel(channelId: string) {
    const next = !isChannelMuted(channelId);
    setMutedChannelIds(channelId, next);
    const allMuted = Object.keys(mutedChannelIds).filter((id) => mutedChannelIds[id]);
    localStorage.setItem(MUTE_STORAGE_KEY, JSON.stringify(allMuted));
    setMutedChannels(allMuted);
    showToast(next ? "Channel muted." : "Channel unmuted.");
  }

  function isChannelNotifyAll(channelId: string): boolean {
    return !!notifyAllChannelIds[channelId];
  }

  function toggleNotifyAllChannel(channelId: string) {
    const next = !isChannelNotifyAll(channelId);
    setNotifyAllChannelIds(channelId, next);
    const allNotifyAll = Object.keys(notifyAllChannelIds).filter((id) => notifyAllChannelIds[id]);
    localStorage.setItem(NOTIFY_ALL_STORAGE_KEY, JSON.stringify(allNotifyAll));
    showToast(
      next
        ? "You’ll be notified about all new messages here."
        : "You’ll only be notified about mentions here.",
    );
  }

  // Central lists for the Settings > Notifications tab — everywhere else, mute
  // and notify-all are set per-channel from that channel's own header/context
  // menu, so this is the only place all of them are visible together.
  const mutedChannels = createMemo<Channel[]>(() =>
    channels().filter((c) => mutedChannelIds[c.id]),
  );
  const notifyAllChannels = createMemo<Channel[]>(() =>
    channels().filter((c) => notifyAllChannelIds[c.id]),
  );

  function isDndActive(): boolean {
    const until = dndSnoozedUntil();
    return !!until && until > Date.now();
  }

  async function snoozeDnd(minutes: number) {
    const until = Date.now() + minutes * 60_000;
    setDndSnoozedUntil(until);
    localStorage.setItem("slock-dnd-until", String(until));
    try {
      await setDndSnooze(minutes);
      showToast(`Do Not Disturb on for ${minutes} minutes.`);
    } catch (err) {
      console.error("Failed to set DND snooze", err);
      showToast("Failed to enable Do Not Disturb.");
    }
  }

  async function endDnd() {
    setDndSnoozedUntil(null);
    localStorage.removeItem("slock-dnd-until");
    try {
      await endDndSnooze();
    } catch (err) {
      console.error("Failed to end DND snooze", err);
    }
  }

  // ---- mark all as read ----

  async function markAllAsRead() {
    const now = String(Date.now() / 1000);
    const targets = [
      ...channels()
        .filter((c) => !isChannelLeft(c.id))
        .map((c) => c.id),
      ...directMessages().map((d) => d.id),
    ];
    for (const id of targets) {
      setUnreadChannelIds(id, false);
      markChannelRead(id, now).catch(() => {});
    }
    showToast("Marked everything as read.");
  }

  // ---- canvas ----

  async function ensureCanvasChecked(channelId: string) {
    if (channelId in canvasByChannel) return;
    try {
      const res = await fetch(`/api/channel/info?channel=${encodeURIComponent(channelId)}`);
      const data = await res.json();
      const canvas = data?.channel?.properties?.canvas;
      setCanvasByChannel(
        channelId,
        canvas?.file_id ? { fileId: canvas.file_id, isEmpty: !!canvas.is_empty } : null,
      );
    } catch {
      setCanvasByChannel(channelId, null);
    }
  }

  function openChannelCanvas(channelId: string) {
    setOpenCanvasChannelId(channelId);
  }

  function closeChannelCanvas() {
    setOpenCanvasChannelId(null);
  }

  async function createCanvasForCurrentChannel(channelId: string) {
    const fileId = await createChannelCanvas(channelId);
    if (!fileId) {
      showToast("Failed to create canvas.");
      return;
    }
    setCanvasByChannel(channelId, { fileId, isEmpty: true });
  }

  async function loadCanvasContent(fileId: string): Promise<string> {
    return (await fetchCanvas(fileId)) ?? "";
  }

  async function saveChannelCanvas(fileId: string, markdown: string) {
    try {
      await saveCanvas(fileId, markdown);
      showToast("Canvas saved.");
    } catch (err) {
      console.error("Failed to save canvas", err);
      showToast("Failed to save canvas.");
    }
  }

  // ---- slash commands ----
  // Well-understood commands map to real documented APIs already wired up
  // elsewhere in this file; anything else is forwarded best-effort to Slack's
  // command dispatch, with the actual error surfaced rather than assumed to
  // have worked, since that internal call can't be verified without live
  // testing against a real workspace.
  async function handleSlashCommand(
    channelId: string,
    threadTs: string | undefined,
    input: string,
  ): Promise<boolean> {
    const match = input.match(/^\/(\S+)\s*(.*)$/s);
    if (!match) return false;
    const [, command, rest] = match;

    switch (command) {
      case "shrug":
        sendMessage(channelId, rest ? `${rest} ¯\\_(ツ)_/¯` : "¯\\_(ツ)_/¯", threadTs);
        return true;
      case "me":
        sendMessage(channelId, rest, threadTs);
        return true;
      case "topic":
        if (!rest.trim()) return true;
        try {
          await setChannelTopic(channelId, rest.trim());
          showToast("Topic updated.");
        } catch (err) {
          showToast(err instanceof Error ? err.message : "Failed to set topic.");
        }
        return true;
      case "remind":
        if (!rest.trim()) return true;
        try {
          await addReminder(rest.trim(), "in 20 minutes");
          showToast("I'll remind you.");
        } catch (err) {
          showToast(err instanceof Error ? err.message : "Failed to set reminder.");
        }
        return true;
      default: {
        const error = await runSlashCommand(channelId, `/${command}`, rest);
        if (error) showToast(error);
        return true;
      }
    }
  }

  async function sendMessage(channelId: string, text: string, threadTs?: string, blocks?: unknown) {
    const trimmed = text.trim();
    if (!trimmed && !blocks) return;
    const me = currentUser();
    const now = Date.now();
    const optimistic: Message = {
      id: `pending-${now}`,
      ts: String(now / 1000),
      userId: me?.id ?? "",
      text: trimmed,
      blocks: blocks as Message["blocks"],
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      day: "Today",
      kind: "normal",
    };
    const key = threadTs ?? channelId;
    const location: MessageLocation = threadTs
      ? { store: "thread", key }
      : { store: "channel", key };
    if (threadTs) {
      setThreadMessages(
        produce((draft) => {
          if (!draft[key]) draft[key] = [];
          draft[key].push(optimistic);
        }),
      );
    } else {
      setMessagesByChannel(
        produce((draft) => {
          if (!draft[key]) draft[key] = [];
          draft[key].push(optimistic);
        }),
      );
    }
    try {
      const res = await postMessage(channelId, trimmed, threadTs, blocks);
      const realTs = res.ts as string;
      // The websocket echo can beat this response back, in which case
      // mergeIncomingMessage already replaced the pending entry with the real
      // one — just drop the (now-stale) pending placeholder rather than
      // renaming it into a second copy of the same message.
      const resolvePending = (list: Message[]) =>
        list.some((m) => m.id !== optimistic.id && (m.ts === realTs || m.id === realTs))
          ? list.filter((m) => m.id !== optimistic.id)
          : list.map((m) => (m.id === optimistic.id ? { ...m, id: realTs, ts: realTs } : m));
      if (location.store === "channel") {
        setMessagesByChannel(location.key, resolvePending);
      } else {
        setThreadMessages(location.key, resolvePending);
      }
    } catch (err) {
      console.error("Failed to send message", err);
      showToast("Failed to send message.");
      removeMessage(location, optimistic.ts);
    }
  }

  function isChannelLeft(channelId: string): boolean {
    return !!leftChannelIds[channelId];
  }

  async function leaveCurrentChannel(channelId: string) {
    try {
      await leaveChannel(channelId);
      setLeftChannelIds(channelId, true);
      if (activeView()?.id === channelId) {
        const next = channels().find((c) => c.id !== channelId && !isChannelLeft(c.id));
        if (next) setActiveView({ kind: "channel", id: next.id });
      }
      showToast("Left the channel.");
    } catch (err) {
      console.error("Failed to leave channel", err);
      showToast("Failed to leave channel.");
    }
  }

  function markCurrentChannelRead(channelId: string) {
    setUnreadChannelIds(channelId, false);
    const list = messagesByChannel[channelId];
    const latest = list?.[list.length - 1]?.ts;
    if (latest) markChannelRead(channelId, latest).catch(() => {});
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
      showToast("Failed to update star.");
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

  return {
    bootstrap,
    sections,
    profileFieldDefs,
    directMessages,
    nav,
    setNavView,
    searchScreenQuery,
    searchScreenFilters,
    openMessageSearch,
    activeView,
    setActiveView,
    openChannelPeek,
    frecencyScore,
    recordEmojiUse,
    emojiUseScore,
    messagesByChannel,
    activeThread,
    threadMessages,
    openThread,
    closeThread,
    userById,
    searchUsers,
    channelById,
    dmById,
    dmIdForUser,
    currentUser,
    sendMessage,
    editMessageText,
    deleteMessageAt,
    reactToMessage,
    isSavedForLater,
    toggleSaveForLater,
    laterItems,
    laterMessages,
    ensureLaterLoaded,
    ensureLaterMessageLoaded,
    activityItems,
    ensureActivityLoaded,
    unreadActivityCount,
    hasUnreadPing,
    hasUnreadGlow,
    markActivityRead,
    lastActivityReadAt,
    profileUserId,
    openUserProfile,
    closeUserProfile,
    openDmWithUser,
    closeDmConversation,
    rtmConnected,
    unreadChannelIds,
    isChannelStarred,
    toggleChannelStar,
    isChannelLeft,
    leaveCurrentChannel,
    markCurrentChannelRead,
    isMessagePinned,
    togglePinMessage,
    copyMessageLink,
    markMessageUnread,
    remindAboutMessage,
    REMINDER_OPTIONS,
    channels,
    pinnedPanelChannelId,
    pinnedMessagesCache,
    openPinnedPanel,
    closePinnedPanel,
    browsableChannels,
    browsingChannels,
    searchBrowsableChannels,
    openBrowseChannels,
    closeBrowseChannels,
    joinChannelById,
    createNewChannel,
    updateMyStatus,
    clearMyStatus,
    updateMyPresence,
    isChannelMuted,
    toggleMuteChannel,
    isChannelNotifyAll,
    toggleNotifyAllChannel,
    mutedChannels,
    notifyAllChannels,
    createChannelSection,
    renameChannelSection,
    deleteChannelSection,
    moveChannelToSection,
    isDndActive,
    dndSnoozedUntil,
    snoozeDnd,
    endDnd,
    markAllAsRead,
    canvasByChannel,
    ensureCanvasChecked,
    openCanvasChannelId,
    openChannelCanvas,
    closeChannelCanvas,
    createCanvasForCurrentChannel,
    loadCanvasContent,
    saveChannelCanvas,
    handleSlashCommand,
  };
}

export const {
  bootstrap,
  sections,
  profileFieldDefs,
  directMessages,
  nav,
  setNavView,
  searchScreenQuery,
  searchScreenFilters,
  openMessageSearch,
  activeView,
  setActiveView,
  openChannelPeek,
  frecencyScore,
  recordEmojiUse,
  emojiUseScore,
  messagesByChannel,
  activeThread,
  threadMessages,
  openThread,
  closeThread,
  userById,
  searchUsers,
  channelById,
  dmById,
  dmIdForUser,
  currentUser,
  sendMessage,
  editMessageText,
  deleteMessageAt,
  reactToMessage,
  isSavedForLater,
  toggleSaveForLater,
  laterItems,
  laterMessages,
  ensureLaterLoaded,
  ensureLaterMessageLoaded,
  activityItems,
  ensureActivityLoaded,
  unreadActivityCount,
  hasUnreadPing,
  hasUnreadGlow,
  markActivityRead,
  lastActivityReadAt,
  profileUserId,
  openUserProfile,
  closeUserProfile,
  openDmWithUser,
  closeDmConversation,
  rtmConnected,
  unreadChannelIds,
  isChannelStarred,
  toggleChannelStar,
  isChannelLeft,
  leaveCurrentChannel,
  markCurrentChannelRead,
  isMessagePinned,
  togglePinMessage,
  copyMessageLink,
  markMessageUnread,
  remindAboutMessage,
  REMINDER_OPTIONS,
  channels,
  pinnedPanelChannelId,
  pinnedMessagesCache,
  openPinnedPanel,
  closePinnedPanel,
  browsableChannels,
  browsingChannels,
  searchBrowsableChannels,
  openBrowseChannels,
  closeBrowseChannels,
  joinChannelById,
  createNewChannel,
  updateMyStatus,
  clearMyStatus,
  updateMyPresence,
  isChannelMuted,
  toggleMuteChannel,
  isChannelNotifyAll,
  toggleNotifyAllChannel,
  mutedChannels,
  notifyAllChannels,
  createChannelSection,
  renameChannelSection,
  deleteChannelSection,
  moveChannelToSection,
  isDndActive,
  dndSnoozedUntil,
  snoozeDnd,
  endDnd,
  markAllAsRead,
  canvasByChannel,
  ensureCanvasChecked,
  openCanvasChannelId,
  openChannelCanvas,
  closeChannelCanvas,
  createCanvasForCurrentChannel,
  loadCanvasContent,
  saveChannelCanvas,
  handleSlashCommand,
} = createRoot(setup);

// Some channels arrive without a human-readable name (shared/external channels,
// or ones we can only see by id). Fall back to a shareable Flaron permalink for
// public channels, and to the bare id only when even that wouldn't resolve
// (private channels we can't publicly link).
export function channelDisplayName(
  channel: Pick<Channel, "id" | "name" | "private"> | undefined,
  fallbackId?: string,
): string {
  const name = channel?.name?.trim();
  if (name) return name;
  const id = channel?.id ?? fallbackId ?? "";
  if (!id) return "";
  if (channel?.private) return id;
  return `https://flaron.halceon.dev/channel/${id}`;
}
