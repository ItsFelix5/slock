import type { User } from "@slock/types";
import { onCleanup } from "solid-js";
import { createStore, produce } from "solid-js/store";

const TYPING_TTL_MS = 4000;

export function createTypingSlice(deps: { userById: (id: string) => User | undefined }) {
  const [typingByKey, setTypingByKey] = createStore<Record<string, Record<string, number>>>({});

  function pruneIfEmpty(key: string) {
    if (Object.keys(typingByKey[key] ?? {}).length === 0) {
      setTypingByKey(
        produce((s) => {
          delete s[key];
        }),
      );
    }
  }

  let sweepTimer: ReturnType<typeof setTimeout> | undefined;

  function sweep() {
    sweepTimer = undefined;
    const now = Date.now();
    let nextExpiry = Number.POSITIVE_INFINITY;
    for (const key of Object.keys(typingByKey)) {
      const entries = typingByKey[key];
      for (const userId of Object.keys(entries)) {
        if (entries[userId] <= now) {
          setTypingByKey(
            key,
            produce((e) => {
              delete e[userId];
            }),
          );
        } else nextExpiry = Math.min(nextExpiry, entries[userId]);
      }
      pruneIfEmpty(key);
    }
    if (nextExpiry !== Number.POSITIVE_INFINITY) armSweep(nextExpiry);
  }

  function armSweep(expiresAt: number) {
    if (sweepTimer) return;
    sweepTimer = setTimeout(sweep, Math.max(expiresAt - Date.now(), 0) + 50);
  }
  onCleanup(() => clearTimeout(sweepTimer));

  const typingKey = (channelId: string, threadTs?: string) =>
    threadTs ? `${channelId}:${threadTs}` : channelId;

  function recordTyping(channelId: string, threadTs: string | undefined, userId: string) {
    const key = typingKey(channelId, threadTs);
    const expiresAt = Date.now() + TYPING_TTL_MS;
    setTypingByKey(
      produce((s) => {
        if (!s[key]) s[key] = {};
        s[key][userId] = expiresAt;
      }),
    );
    armSweep(expiresAt);
  }

  function clearTyping(channelId: string, threadTs: string | undefined, userId: string) {
    const key = typingKey(channelId, threadTs);
    if (!typingByKey[key]?.[userId]) return;
    setTypingByKey(
      key,
      produce((e) => {
        delete e[userId];
      }),
    );
    pruneIfEmpty(key);
  }

  function typingUsersInChannel(channelId: string): User[] {
    const entries = typingByKey[channelId];
    if (!entries) return [];
    return Object.keys(entries)
      .map(deps.userById)
      .filter((u): u is User => !!u);
  }

  function typingUsersInThread(channelId: string, ts: string): User[] {
    const entries = typingByKey[typingKey(channelId, ts)];
    if (!entries) return [];
    return Object.keys(entries)
      .map(deps.userById)
      .filter((u): u is User => !!u);
  }

  return {
    clearTyping,
    recordTyping,
    typingUsersInChannel,
    typingUsersInThread,
  };
}
