import { splitHighlightWords } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import type { ChannelId, UserPrefs } from "@slock/types";
import { createQuery } from "@tanstack/solid-query";
import { createEffect, createSignal } from "solid-js";
import { defineKey } from "../../query/client/api";
import {
  endDndSnooze,
  fetchDndStatus,
  PairedPreferenceWriteError,
  setChannelNotifyAll,
  setDndSnooze,
  setHighlightWords as setHighlightWordsApi,
} from "../../slack/client/api";
import {
  emojiUseScore as calculateEmojiUseScore,
  frecencyScore as calculateFrecencyScore,
  recentIds as calculateRecentIds,
  usedEmojiNames as calculateUsedEmojiNames,
} from "./lib/frecency";
import { createChannelFlags } from "./channelFlags";
import { createMuteSync } from "./muteSync";

const feedback = service("feedback");
const query = service("query");
const dndStatusKey = defineKey("dndStatus");

export function createPrefsStore(deps: { userPrefs: () => UserPrefs | undefined }) {
  const muted = createChannelFlags();
  const notifyAll = createChannelFlags();
  const [highlightWords, setHighlightWordsSignal] = createSignal<string[]>([]);
  const [highlightWordsPending, setHighlightWordsPending] = createSignal(false);
  const [dndSnoozedUntil, setDndSnoozedUntil] = createSignal<number | null>(null);
  const [dndPending, setDndPending] = createSignal(false);
  const dndStatus = createQuery(
    () => ({ queryFn: fetchDndStatus, queryKey: dndStatusKey() }),
    () => query.client,
  );

  let muteClicks = 0;
  let lastMuteChannelId: ChannelId | undefined;
  const muteSync = createMuteSync((confirmedIds) => {
    if (lastMuteChannelId) feedback.error(lastMuteChannelId, "Failed to update mute setting.");
    muted.settleAll();
    muted.sync(confirmedIds, { respectPending: false });
  });

  function syncRemotePrefs(prefs: UserPrefs) {
    muteSync.confirm(prefs.mutedChannels);
    muted.sync(prefs.mutedChannels, { respectPending: true });
    notifyAll.sync(prefs.notifyAllChannels, { respectPending: true });
    setHighlightWordsSignal(prefs.highlightWords);
  }

  let mutePrefsSeeded = false;
  createEffect(
    () => deps.userPrefs(),
    (prefs) => {
      if (!prefs || mutePrefsSeeded) return;
      mutePrefsSeeded = true;
      syncRemotePrefs(prefs);
    },
  );

  function preferencesReady(): boolean {
    return deps.userPrefs() !== undefined;
  }

  function requirePreferences(feedbackKey: string): boolean {
    if (preferencesReady()) return true;
    feedback.error(feedbackKey, "Preferences are unavailable. Try loading them again.");
    return false;
  }

  createEffect(
    () => (dndStatus.error ? undefined : dndStatus.data),
    (status) => {
      if (status !== undefined) setDndSnoozedUntil(status);
    },
  );

  createEffect(dndSnoozedUntil, (until) => {
    if (!until) return;
    const remaining = until - Date.now();
    if (remaining <= 0) {
      setDndSnoozedUntil(null);
      return;
    }
    const timer = setTimeout(() => setDndSnoozedUntil(null), remaining);
    return () => clearTimeout(timer);
  });

  const isChannelMuted = (channelId: string) => muted.isEnabled(channelId);

  function isMutePending(): boolean {
    return !preferencesReady();
  }

  async function toggleMuteChannel(channelId: ChannelId): Promise<boolean> {
    if (!requirePreferences(channelId)) return false;
    const next = !isChannelMuted(channelId);
    const click = ++muteClicks;
    lastMuteChannelId = channelId;
    const mutedIds = muted.enabledIdsWith(channelId, next);
    muted.begin(channelId, next);
    const synced = await muteSync.push(mutedIds);
    if (!synced || click !== muteClicks) return synced;
    muted.settleAll();
    feedback.undo.push({
      label: next ? "mute channel" : "unmute channel",
      undo: () => void toggleMuteChannel(channelId),
    });
    return true;
  }

  const isChannelNotifyAll = (channelId: string) => notifyAll.isEnabled(channelId);

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
      feedback.error("pingwords", "Failed to update pingwords.");
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
    return !preferencesReady() || notifyAll.isPending(channelId);
  }

  async function toggleNotifyAllChannel(channelId: ChannelId): Promise<boolean> {
    if (!requirePreferences(channelId) || isNotifyAllPending(channelId)) return false;
    const next = !isChannelNotifyAll(channelId);
    notifyAll.begin(channelId, next);
    try {
      await setChannelNotifyAll(channelId, next, deps.userPrefs()?.channelNotifications[channelId]);
      return true;
    } catch (err) {
      console.error("Failed to set channel notification preference", err);
      feedback.error(
        channelId,
        err instanceof PairedPreferenceWriteError && !err.rollbackComplete
          ? "Slack only updated part of this notification setting. Reload to verify it."
          : "Failed to update notification preference.",
      );
      notifyAll.set(channelId, !next);
      return false;
    } finally {
      notifyAll.settle(channelId);
    }
  }

  function matchingHighlightWord(text: string): string | undefined {
    return splitHighlightWords(text, highlightWords()).find((seg) => seg.highlighted)?.text;
  }

  function isDndActive(): boolean {
    const until = dndSnoozedUntil();
    return !!until && until > Date.now();
  }

  const frecencyScore = (id: string) => calculateFrecencyScore(deps.userPrefs(), id);
  const recentIds = () => calculateRecentIds(deps.userPrefs());
  const emojiUseScore = (name: string) => calculateEmojiUseScore(deps.userPrefs(), name);
  const usedEmojiNames = () => calculateUsedEmojiNames(deps.userPrefs());

  function isDndPending(): boolean {
    return dndPending() || dndStatus.isFetching;
  }

  function hasDndStatusError(): boolean {
    return !!dndStatus.error;
  }

  async function retryDndStatus(): Promise<void> {
    await dndStatus.refetch();
  }

  function applyDndSnoozeEvent(snoozedUntil: number | null): void {
    setDndSnoozedUntil(snoozedUntil);
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
      feedback.error("dnd", "Failed to enable Do Not Disturb.");
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
      feedback.error("dnd", "Failed to disable Do Not Disturb.");
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
    recentIds,
    syncRemotePrefs,
    usedEmojiNames,
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
    preferencesReady,
    removeHighlightWord,
    applyDndSnoozeEvent,
    retryDndStatus,
    snoozeDnd,
    toggleMuteChannel,
    toggleNotifyAllChannel,
  };
}
