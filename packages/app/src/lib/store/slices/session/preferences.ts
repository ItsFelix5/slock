import type { Channel, UserPrefs } from "@slock/slack-api";
import {
  endDndSnooze,
  fetchDndStatus,
  PairedPreferenceWriteError,
  setChannelNotifyAll,
  setDndSnooze,
  setHighlightWords as setHighlightWordsApi,
  setMutedChannels,
} from "@slock/slack-api";
import { createEffect, createMemo, createResource, createSignal, onCleanup } from "solid-js";
import { createStore } from "solid-js/store";
import {
  emojiUseScore as calculateEmojiUseScore,
  frecencyScore as calculateFrecencyScore,
} from "../../../frecency";
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
  recordUndoableAction: (label: string, undo: () => void) => void;
}) {
  const [mutedChannelIds, setMutedChannelIds] = createStore<Record<string, boolean>>({});
  const [mutePendingByChannel, setMutePendingByChannel] = createStore<Record<string, boolean>>({});
  const [notifyAllChannelIds, setNotifyAllChannelIds] = createStore<Record<string, boolean>>({});
  const [notifyAllPendingByChannel, setNotifyAllPendingByChannel] = createStore<
    Record<string, boolean>
  >({});
  const [highlightWords, setHighlightWordsSignal] = createSignal<string[]>([]);
  const [highlightWordsPending, setHighlightWordsPending] = createSignal(false);
  const [dndSnoozedUntil, setDndSnoozedUntil] = createSignal<number | null>(null);
  const [dndPending, setDndPending] = createSignal(false);
  const [dndStatus, { refetch: refetchDndStatus }] = createResource(fetchDndStatus);

  let mutePrefsSeeded = false;
  createEffect(() => {
    const prefs = deps.userPrefs();
    if (!prefs || mutePrefsSeeded) return;
    mutePrefsSeeded = true;
    for (const id of prefs.mutedChannels) setMutedChannelIds(id, true);
    for (const id of prefs.notifyAllChannels) setNotifyAllChannelIds(id, true);
    setHighlightWordsSignal(prefs.highlightWords);
  });

  function preferencesReady(): boolean {
    return deps.userPrefs() !== undefined;
  }

  function requirePreferences(feedbackKey: string): boolean {
    if (preferencesReady()) return true;
    actionFeedback.flash(
      feedbackKey,
      "Preferences are unavailable. Try loading them again.",
      "error",
    );
    return false;
  }

  createEffect(() => {
    if (dndStatus.error) {
      actionFeedback.flash("dnd", "Couldn’t load Do Not Disturb status. Click to retry.", "error");
      return;
    }
    const status = dndStatus();
    if (status !== undefined) setDndSnoozedUntil(status);
  });

  // isDndActive() only re-evaluates when dndSnoozedUntil() itself changes — without
  // this, a snooze that lapses while nothing else touches the signal would leave the
  // UI reporting DND as active forever, until the user manually toggles it again.
  createEffect(() => {
    const until = dndSnoozedUntil();
    if (!until) return;
    const remaining = until - Date.now();
    if (remaining <= 0) {
      setDndSnoozedUntil(null);
      return;
    }
    const timer = setTimeout(() => setDndSnoozedUntil(null), remaining);
    onCleanup(() => clearTimeout(timer));
  });

  function isChannelMuted(channelId: string): boolean {
    return !!mutedChannelIds[channelId];
  }

  function isAnyMutePending(): boolean {
    return Object.values(mutePendingByChannel).some(Boolean);
  }

  function isMutePending(channelId: string): boolean {
    return !preferencesReady() || isAnyMutePending() || !!mutePendingByChannel[channelId];
  }

  async function toggleMuteChannel(channelId: string): Promise<boolean> {
    if (!requirePreferences(channelId) || isMutePending(channelId)) return false;
    const next = !isChannelMuted(channelId);
    setMutePendingByChannel(channelId, true);
    setMutedChannelIds(channelId, next);
    const allMuted = Object.keys(mutedChannelIds).filter((id) => mutedChannelIds[id]);
    try {
      await setMutedChannels(allMuted);
      deps.recordUndoableAction(
        next ? "Muted channel" : "Unmuted channel",
        () => void toggleMuteChannel(channelId),
      );
      return true;
    } catch (err) {
      console.error("Failed to set channel mute preference", err);
      actionFeedback.flash(channelId, "Failed to update mute setting.", "error");
      setMutedChannelIds(channelId, !next);
      return false;
    } finally {
      setMutePendingByChannel(channelId, false);
    }
  }

  function isChannelNotifyAll(channelId: string): boolean {
    return !!notifyAllChannelIds[channelId];
  }

  function isHighlightWordsPending(): boolean {
    return !preferencesReady() || highlightWordsPending();
  }

  async function persistHighlightWords(words: string[]): Promise<boolean> {
    if (!requirePreferences("pingwords") || highlightWordsPending()) return false;
    const previous = highlightWords();
    setHighlightWordsPending(true);
    setHighlightWordsSignal(words);
    try {
      await setHighlightWordsApi(words);
      return true;
    } catch (err) {
      console.error("Failed to set pingwords", err);
      actionFeedback.flash("pingwords", "Failed to update pingwords.", "error");
      setHighlightWordsSignal(previous);
      return false;
    } finally {
      setHighlightWordsPending(false);
    }
  }

  function addHighlightWord(word: string): Promise<boolean> {
    const trimmed = word.trim();
    if (!trimmed || highlightWords().some((w) => w.toLowerCase() === trimmed.toLowerCase()))
      return Promise.resolve(false);
    return persistHighlightWords([...highlightWords(), trimmed]);
  }

  function removeHighlightWord(word: string): Promise<boolean> {
    return persistHighlightWords(highlightWords().filter((wordToRemove) => wordToRemove !== word));
  }

  function isNotifyAllPending(channelId: string): boolean {
    return !preferencesReady() || !!notifyAllPendingByChannel[channelId];
  }

  async function toggleNotifyAllChannel(channelId: string): Promise<boolean> {
    if (!requirePreferences(channelId) || isNotifyAllPending(channelId)) return false;
    const next = !isChannelNotifyAll(channelId);
    setNotifyAllPendingByChannel(channelId, true);
    setNotifyAllChannelIds(channelId, next);
    try {
      await setChannelNotifyAll(channelId, next, deps.userPrefs()?.channelNotifications[channelId]);
      return true;
    } catch (err) {
      console.error("Failed to set channel notification preference", err);
      actionFeedback.flash(
        channelId,
        err instanceof PairedPreferenceWriteError && !err.rollbackComplete
          ? "Slack only updated part of this notification setting. Reload to verify it."
          : "Failed to update notification preference.",
        "error",
      );
      setNotifyAllChannelIds(channelId, !next);
      return false;
    } finally {
      setNotifyAllPendingByChannel(channelId, false);
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

  const frecencyScore = (id: string) => calculateFrecencyScore(deps.userPrefs(), id);
  const emojiUseScore = (name: string) => calculateEmojiUseScore(deps.userPrefs(), name);

  function isDndPending(): boolean {
    return dndPending() || dndStatus.loading;
  }

  function hasDndStatusError(): boolean {
    return !!dndStatus.error;
  }

  async function retryDndStatus(): Promise<void> {
    try {
      await refetchDndStatus();
    } catch {
      // The resource effect refreshes the actionable feedback.
    }
  }

  async function snoozeDnd(minutes: number): Promise<boolean> {
    if (dndPending()) return false;
    const previous = dndSnoozedUntil();
    const until = Date.now() + minutes * 60_000;
    setDndPending(true);
    setDndSnoozedUntil(until);
    try {
      await setDndSnooze(minutes);
      return true;
    } catch (err) {
      console.error("Failed to set DND snooze", err);
      actionFeedback.flash("dnd", "Failed to enable Do Not Disturb.", "error");
      setDndSnoozedUntil(previous);
      return false;
    } finally {
      setDndPending(false);
    }
  }

  async function endDnd(): Promise<boolean> {
    if (dndPending()) return false;
    const previous = dndSnoozedUntil();
    setDndPending(true);
    setDndSnoozedUntil(null);
    try {
      await endDndSnooze();
      return true;
    } catch (err) {
      console.error("Failed to end DND snooze", err);
      actionFeedback.flash("dnd", "Failed to disable Do Not Disturb.", "error");
      setDndSnoozedUntil(previous);
      return false;
    } finally {
      setDndPending(false);
    }
  }

  return {
    addHighlightWord,
    dndSnoozedUntil,
    endDnd,
    emojiUseScore,
    frecencyScore,
    highlightWords,
    hasDndStatusError,
    isChannelMuted,
    isChannelNotifyAll,
    isDndActive,
    isDndPending,
    isHighlightWordsPending,
    isMutePending,
    isNotifyAllPending,
    matchingHighlightWord,
    mutedChannels,
    notifyAllChannelIds,
    notifyAllChannels,
    preferencesReady,
    removeHighlightWord,
    retryDndStatus,
    snoozeDnd,
    toggleMuteChannel,
    toggleNotifyAllChannel,
  };
}
