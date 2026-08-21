import { onCleanup } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type { User } from "../../../api";

const TYPING_TTL_MS = 4000;

export function createTypingSlice(deps: { userById: (id: string) => User | undefined }) {
  const [typingByKey, setTypingByKey] = createStore<Record<string, Record<string, number>>>({});

  const sweepTimer: ReturnType<typeof setInterval> = setInterval(() => {
    const now = Date.now();
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
        }
      }
    }
  }, 1000);
  onCleanup(() => clearInterval(sweepTimer));

  function recordTyping(channelId: string, threadTs: string | undefined, userId: string) {
    const key = threadTs ? `${channelId}:${threadTs}` : channelId;
    const expiresAt = Date.now() + TYPING_TTL_MS;
    setTypingByKey(
      produce((s) => {
        if (!s[key]) s[key] = {};
        s[key][userId] = expiresAt;
      }),
    );
  }

  function clearTyping(channelId: string, threadTs: string | undefined, userId: string) {
    const key = threadTs ? `${channelId}:${threadTs}` : channelId;
    if (!typingByKey[key]?.[userId]) return;
    setTypingByKey(
      key,
      produce((e) => {
        delete e[userId];
      }),
    );
  }

  function typingUsersInChannel(channelId: string): User[] {
    const entries = typingByKey[channelId];
    if (!entries) return [];
    return Object.keys(entries)
      .map(deps.userById)
      .filter((u): u is User => !!u);
  }

  function typingUsersInThread(channelId: string, ts: string): User[] {
    const entries = typingByKey[`${channelId}:${ts}`];
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
