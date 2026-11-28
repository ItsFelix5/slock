import { splitHighlightWords } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import { defineMutation } from "@slock/plugins/query/client/api";
import type { Overlay } from "@slock/resource";
import type { ChannelId, UserPrefs } from "@slock/types";
import { createMemo } from "solid-js";
import { PairedPreferenceWriteError } from "./pairedPreferenceWrite";
import { notifyValue, setChannelNotifyAll, setHighlightWords, setMutedChannels } from "./requests";

const feedback = service("feedback");

const withId = (ids: ChannelId[], id: ChannelId, present: boolean) => {
  if (ids.includes(id) === present) return ids;
  return present ? [...ids, id] : ids.filter((other) => other !== id);
};

function withNotifyAll(prefs: UserPrefs, channelId: ChannelId, enabled: boolean): UserPrefs {
  const value = notifyValue(enabled);
  return {
    ...prefs,
    channelNotifications: {
      ...prefs.channelNotifications,
      [channelId]: { desktop: value, mobile: value },
    },
    notifyAllChannels: withId(prefs.notifyAllChannels, channelId, enabled),
  };
}

export function createNotificationPrefs(deps: {
  overlayUserPrefs: (change: (current: UserPrefs) => UserPrefs) => Overlay;
  userPrefs: () => UserPrefs | undefined;
}) {
  const mutedIds = createMemo(() => new Set(deps.userPrefs()?.mutedChannels));
  const notifyAllIds = createMemo(() => new Set(deps.userPrefs()?.notifyAllChannels));
  const highlightWords = createMemo(() => deps.userPrefs()?.highlightWords ?? []);
  const preferencesReady = () => deps.userPrefs() !== undefined;

  function requirePreferences(feedbackKey: string): boolean {
    if (preferencesReady()) return true;
    feedback.error(feedbackKey, "Preferences are unavailable. Try loading them again.");
    return false;
  }

  const muting = defineMutation<{ channelId: ChannelId; ids: ChannelId[]; muted: boolean }>({
    mode: "latest",
    onError: (error, { channelId }) => {
      console.error("Failed to set channel mute preference", error);
      feedback.error(channelId, "Failed to update mute setting.");
    },
    onSuccess: (_, { channelId, muted }) => {
      if (muting.pending()) return;
      feedback.undo.push({
        label: muted ? "mute channel" : "unmute channel",
        undo: () => void toggleMuteChannel(channelId),
      });
    },
    optimistic: ({ ids }, transaction) =>
      transaction.hold(deps.overlayUserPrefs((prefs) => ({ ...prefs, mutedChannels: ids }))),
    run: ({ ids }) => setMutedChannels(ids),
  });

  function toggleMuteChannel(channelId: ChannelId): Promise<boolean> {
    if (!requirePreferences(channelId)) return Promise.resolve(false);
    const muted = !mutedIds().has(channelId);
    const ids = withId([...mutedIds()], channelId, muted);
    return muting.run({ channelId, ids, muted });
  }

  const notifying = defineMutation<{
    channelId: ChannelId;
    enabled: boolean;
    previous: UserPrefs["channelNotifications"][ChannelId] | undefined;
  }>({
    key: ({ channelId }) => channelId,
    mode: "single",
    onError: (error, { channelId }) => {
      console.error("Failed to set channel notification preference", error);
      feedback.error(
        channelId,
        error instanceof PairedPreferenceWriteError && !error.rollbackComplete
          ? "Slack only updated part of this notification setting. Reload to verify it."
          : "Failed to update notification preference.",
      );
    },
    optimistic: ({ channelId, enabled }, transaction) =>
      transaction.hold(deps.overlayUserPrefs((prefs) => withNotifyAll(prefs, channelId, enabled))),
    run: ({ channelId, enabled, previous }) => setChannelNotifyAll(channelId, enabled, previous),
  });
  const isNotifyAllPending = (channelId: ChannelId) =>
    !preferencesReady() || notifying.pending(channelId);

  function toggleNotifyAllChannel(channelId: ChannelId): Promise<boolean> {
    if (!requirePreferences(channelId)) return Promise.resolve(false);
    return notifying.run({
      channelId,
      enabled: !notifyAllIds().has(channelId),
      previous: deps.userPrefs()?.channelNotifications[channelId],
    });
  }

  const highlighting = defineMutation<string[]>({
    mode: "single",
    onError: (error) => {
      console.error("Failed to set pingwords", error);
      feedback.error("pingwords", "Failed to update pingwords.");
    },
    optimistic: (words, transaction) =>
      transaction.hold(deps.overlayUserPrefs((prefs) => ({ ...prefs, highlightWords: words }))),
    run: setHighlightWords,
  });

  const saveHighlightWords = (words: string[]) =>
    requirePreferences("pingwords") ? highlighting.run(words) : Promise.resolve(false);

  function addHighlightWord(word: string): Promise<boolean> {
    const trimmed = word.trim();
    if (!trimmed || highlightWords().some((w) => w.toLowerCase() === trimmed.toLowerCase()))
      return Promise.resolve(false);
    return saveHighlightWords([...highlightWords(), trimmed]);
  }

  return {
    addHighlightWord,
    highlightWords,
    isChannelMuted: (channelId: ChannelId) => mutedIds().has(channelId),
    isChannelNotifyAll: (channelId: ChannelId) => notifyAllIds().has(channelId),
    isHighlightWordsPending: () => !preferencesReady() || highlighting.pending(),
    isMutePending: () => !preferencesReady(),
    isNotifyAllPending,
    matchingHighlightWord: (text: string) =>
      splitHighlightWords(text, highlightWords()).find((seg) => seg.highlighted)?.text,
    preferencesReady,
    removeHighlightWord: (word: string) =>
      saveHighlightWords(highlightWords().filter((other) => other !== word)),
    toggleMuteChannel,
    toggleNotifyAllChannel,
  };
}
