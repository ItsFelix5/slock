import { createResource, createSignal, createEffect, createMemo, createRoot, onCleanup } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import {
  fetchBootstrap,
  fetchHistory,
  fetchReplies,
  fetchUser,
  postMessage,
  editMessage,
  deleteMessage,
  toggleReaction,
  toggleSaved,
} from './slackApi';
import type { Message, User, Channel, DirectMessage } from './types';

export type View = { kind: 'channel'; id: string } | { kind: 'dm'; id: string };
export type ThreadRef = { channelId: string; ts: string };
// Where a given Message lives in the store, so actions (edit/delete/react) can
// patch the right list — a message can appear in a channel's history and/or a thread's replies.
export type MessageLocation = { store: 'channel'; key: string } | { store: 'thread'; key: string };

const POLL_INTERVAL_MS = 3000;

function mergeMessages(existing: Message[], fresh: Message[]): Message[] {
  const freshById = new Map(fresh.map((m) => [m.id, m]));
  const pendingOnly = existing.filter((m) => m.id.startsWith('pending-') && !freshById.has(m.id));
  const merged = [...fresh, ...pendingOnly];
  merged.sort((a, b) => parseFloat(a.ts || '0') - parseFloat(b.ts || '0') || (a.id < b.id ? -1 : 1));
  return merged;
}

function setup() {
  const [bootstrap] = createResource(fetchBootstrap);
  const [selected, setSelected] = createSignal<View | null>(null);
  const [messagesByChannel, setMessagesByChannel] = createStore<Record<string, Message[]>>({});
  const loadedChannels = new Set<string>();
  const [extraUsers, setExtraUsers] = createStore<Record<string, User>>({});
  const pendingUsers = new Set<string>();

  const [activeThread, setActiveThread] = createSignal<ThreadRef | null>(null);
  const [threadMessages, setThreadMessages] = createStore<Record<string, Message[]>>({});
  const loadedThreads = new Set<string>();

  const activeView = createMemo<View | null>(() => {
    const explicit = selected();
    if (explicit) return explicit;
    const data = bootstrap();
    if (!data) return null;
    if (data.channels[0]) return { kind: 'channel', id: data.channels[0].id };
    if (data.directMessages[0]) return { kind: 'dm', id: data.directMessages[0].id };
    return null;
  });

  function setActiveView(view: View) {
    setActiveThread(null);
    setSelected(view);
  }

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

  // Poll the active channel for new messages (a lightweight stand-in for a real-time
  // websocket connection, which Slack's internal client API doesn't expose here).
  createEffect(() => {
    const view = activeView();
    if (!view) return;
    const timer = setInterval(() => {
      fetchHistory(view.id)
        .then((fresh) => {
          setMessagesByChannel(view.id, (existing = []) => mergeMessages(existing, fresh));
        })
        .catch(() => {});
    }, POLL_INTERVAL_MS);
    onCleanup(() => clearInterval(timer));
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

  createEffect(() => {
    const thread = activeThread();
    if (!thread) return;
    const key = thread.ts;
    const timer = setInterval(() => {
      fetchReplies(thread.channelId, thread.ts)
        .then((fresh) => {
          setThreadMessages(key, (existing = []) => mergeMessages(existing, fresh));
        })
        .catch(() => {});
    }, POLL_INTERVAL_MS);
    onCleanup(() => clearInterval(timer));
  });

  function userById(id: string): User | undefined {
    const known = bootstrap()?.users.find((u) => u.id === id);
    if (known) return known;
    const extra = extraUsers[id];
    if (extra) return extra;
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

  function channelById(id: string): Channel | undefined {
    return bootstrap()?.channels.find((c) => c.id === id);
  }

  function dmById(id: string): DirectMessage | undefined {
    return bootstrap()?.directMessages.find((d) => d.id === id);
  }

  function currentUser(): User | undefined {
    return bootstrap()?.currentUser;
  }

  function openThread(channelId: string, ts: string) {
    setActiveThread({ channelId, ts });
  }

  function closeThread() {
    setActiveThread(null);
  }

  function patchMessage(location: MessageLocation, ts: string, patch: Partial<Message>) {
    const match = (m: Message) => m.ts === ts;
    if (location.store === 'channel') {
      setMessagesByChannel(location.key, match, patch);
    } else {
      setThreadMessages(location.key, match, patch);
    }
  }

  function removeMessage(location: MessageLocation, ts: string) {
    const remove = (list: Message[]) => {
      const idx = list.findIndex((m) => m.ts === ts);
      if (idx !== -1) list.splice(idx, 1);
    };
    if (location.store === 'channel') {
      setMessagesByChannel(location.key, produce(remove));
    } else {
      setThreadMessages(location.key, produce(remove));
    }
  }

  async function editMessageText(location: MessageLocation, channelId: string, ts: string, text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      await editMessage(channelId, ts, trimmed);
      patchMessage(location, ts, { text: trimmed, editedLocally: true });
    } catch (err) {
      console.error('Failed to edit message', err);
    }
  }

  async function deleteMessageAt(location: MessageLocation, channelId: string, ts: string) {
    try {
      await deleteMessage(channelId, ts);
      removeMessage(location, ts);
    } catch (err) {
      console.error('Failed to delete message', err);
    }
  }

  async function reactToMessage(location: MessageLocation, channelId: string, msg: Message, emojiName: string) {
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
      console.error('Failed to toggle reaction', err);
      patchMessage(location, msg.ts, { reactions: previousReactions });
    }
  }

  const [savedTs, setSavedTs] = createStore<Record<string, boolean>>({});

  async function toggleSaveForLater(channelId: string, ts: string) {
    const currentlySaved = !!savedTs[ts];
    setSavedTs(ts, !currentlySaved);
    try {
      await toggleSaved(channelId, ts, currentlySaved);
    } catch (err) {
      console.error('Failed to toggle saved-for-later', err);
      setSavedTs(ts, currentlySaved);
    }
  }

  async function sendMessage(channelId: string, text: string, threadTs?: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const me = currentUser();
    const now = Date.now();
    const optimistic: Message = {
      id: `pending-${now}`,
      ts: String(now / 1000),
      userId: me?.id ?? '',
      text: trimmed,
      time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      day: 'Today',
    };
    const key = threadTs ?? channelId;
    const location: MessageLocation = threadTs ? { store: 'thread', key } : { store: 'channel', key };
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
      const res = await postMessage(channelId, trimmed, threadTs);
      // Swap the optimistic id/ts for the real ones Slack assigned, so the next
      // poll recognizes this message as already present instead of duplicating it.
      const match = (m: Message) => m.id === optimistic.id;
      const realTs = res.ts as string;
      if (location.store === 'channel') {
        setMessagesByChannel(location.key, match, { id: realTs, ts: realTs });
      } else {
        setThreadMessages(location.key, match, { id: realTs, ts: realTs });
      }
    } catch (err) {
      console.error('Failed to send message', err);
      removeMessage(location, optimistic.ts);
    }
  }

  return {
    bootstrap,
    activeView,
    setActiveView,
    messagesByChannel,
    activeThread,
    threadMessages,
    openThread,
    closeThread,
    userById,
    channelById,
    dmById,
    currentUser,
    sendMessage,
    editMessageText,
    deleteMessageAt,
    reactToMessage,
    savedTs,
    toggleSaveForLater,
  };
}

export const {
  bootstrap,
  activeView,
  setActiveView,
  messagesByChannel,
  activeThread,
  threadMessages,
  openThread,
  closeThread,
  userById,
  channelById,
  dmById,
  currentUser,
  sendMessage,
  editMessageText,
  deleteMessageAt,
  reactToMessage,
  savedTs,
  toggleSaveForLater,
} = createRoot(setup);
