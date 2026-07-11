import type { Channel, UserPrefs } from "@slock/slack-api";
import {
  endDndSnooze,
  fetchDndStatus,
  setChannelNotifyAll,
  setDndSnooze,
  setHighlightWords as setHighlightWordsApi,
  setMutedChannels,
} from "@slock/slack-api";
import { createEffect, createMemo, createResource, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { actionFeedback } from "../feedback";

// Escapes regex metacharacters in a user-typed keyword before building a
// word-boundary RegExp out of it.
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Muted / notify-all channels, pingwords, and DND snooze all live on the real
// Slack account (users.prefs / dnd.info) — these seed from there via
// createEffect below rather than from localStorage, once the boot fetch resolves.
export function createPreferencesSlice(deps: {
  channels: () => Channel[];
  userPrefs: () => UserPrefs | undefined;
}) {
  const [mutedChannelIds, setMutedChannelIds] = createStore<Record<string, boolean>>({});
  const [notifyAllChannelIds, setNotifyAllChannelIds] = createStore<Record<string, boolean>>({});
  const [highlightWords, setHighlightWordsSignal] = createSignal<string[]>([]);
  const [dndSnoozedUntil, setDndSnoozedUntil] = createSignal<number | null>(null);
  const [dndStatus] = createResource(fetchDndStatus);

  let mutePrefsSeeded = false;
  createEffect(() => {
    const prefs = deps.userPrefs();
    if (!prefs || mutePrefsSeeded) return;
    mutePrefsSeeded = true;
    for (const id of prefs.mutedChannels) setMutedChannelIds(id, true);
    for (const id of prefs.notifyAllChannels) setNotifyAllChannelIds(id, true);
    setHighlightWordsSignal(prefs.highlightWords);
  });

  createEffect(() => {
    const status = dndStatus();
    if (status !== undefined) setDndSnoozedUntil(status);
  });

  function isChannelMuted(channelId: string): boolean {
    return !!mutedChannelIds[channelId];
  }

  async function toggleMuteChannel(channelId: string) {
    const next = !isChannelMuted(channelId);
    setMutedChannelIds(channelId, next);
    const allMuted = Object.keys(mutedChannelIds).filter((id) => mutedChannelIds[id]);
    try {
      await setMutedChannels(allMuted);
    } catch (err) {
      console.error("Failed to set channel mute preference", err);
    }
  }

  function isChannelNotifyAll(channelId: string): boolean {
    return !!notifyAllChannelIds[channelId];
  }

  async function toggleNotifyAllChannel(channelId: string) {
    const next = !isChannelNotifyAll(channelId);
    setNotifyAllChannelIds(channelId, next);
    try {
      await setChannelNotifyAll(channelId, next);
    } catch (err) {
      console.error("Failed to set channel notification preference", err);
    }
  }

  // Central lists for the Settings > Notifications tab — everywhere else, mute
  // and notify-all are set per-channel from that channel's own header/context
  // menu, so this is the only place all of them are visible together.
  const mutedChannels = createMemo<Channel[]>(() =>
    deps.channels().filter((c) => mutedChannelIds[c.id]),
  );
  const notifyAllChannels = createMemo<Channel[]>(() =>
    deps.channels().filter((c) => notifyAllChannelIds[c.id]),
  );

  async function persistHighlightWords(words: string[]) {
    setHighlightWordsSignal(words);
    try {
      await setHighlightWordsApi(words);
    } catch (err) {
      console.error("Failed to set pingwords", err);
    }
  }

  async function addHighlightWord(word: string) {
    const trimmed = word.trim();
    if (!trimmed || highlightWords().some((w) => w.toLowerCase() === trimmed.toLowerCase())) return;
    await persistHighlightWords([...highlightWords(), trimmed]);
  }

  async function removeHighlightWord(word: string) {
    await persistHighlightWords(highlightWords().filter((w) => w !== word));
  }

  // The keyword that pings via <text> the way an @mention does — first match
  // wins, case-insensitive, on a whole word (so "cat" doesn't fire on
  // "concatenate"). Mirrors Slack's own "highlight words" notification setting.
  function matchingHighlightWord(text: string): string | undefined {
    return highlightWords().find((word) =>
      new RegExp(`\\b${escapeRegExp(word)}\\b`, "i").test(text),
    );
  }

  function isDndActive(): boolean {
    const until = dndSnoozedUntil();
    return !!until && until > Date.now();
  }

  async function snoozeDnd(minutes: number) {
    const until = Date.now() + minutes * 60_000;
    setDndSnoozedUntil(until);
    try {
      await setDndSnooze(minutes);
    } catch (err) {
      console.error("Failed to set DND snooze", err);
      actionFeedback.flash("dnd", "Failed to enable Do Not Disturb.", "error");
    }
  }

  async function endDnd() {
    setDndSnoozedUntil(null);
    try {
      await endDndSnooze();
    } catch (err) {
      console.error("Failed to end DND snooze", err);
    }
  }

  return {
    notifyAllChannelIds,
    isChannelMuted,
    toggleMuteChannel,
    isChannelNotifyAll,
    toggleNotifyAllChannel,
    mutedChannels,
    notifyAllChannels,
    highlightWords,
    addHighlightWord,
    removeHighlightWord,
    matchingHighlightWord,
    isDndActive,
    dndSnoozedUntil,
    snoozeDnd,
    endDnd,
  };
}
