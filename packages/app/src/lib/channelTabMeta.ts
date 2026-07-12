import type { IconName } from "@slock/ui";

// The only tab type a user can freely add/remove/reorder in this app's own
// tab bar. Kept to just one on purpose: things like Canvas aren't a good fit
// here — a channel can have several, so a single toggleable entry can't
// represent it — those instead just show up automatically when relevant
// (see ChannelHeader/ChannelTabsTab), never as a manual add/remove choice.
export type ChannelTabType = "pinned";

export const ADDABLE_CHANNEL_TABS: { type: ChannelTabType; label: string; icon: IconName }[] = [
  { type: "pinned", label: "Pinned", icon: "pin-filled" },
];

// actionFeedback is a single flat keyspace shared by lots of unrelated
// features (e.g. plain channel ids are also the composer's send-error key) —
// namespaced so a tab-sync failure doesn't show up in the composer.
export function channelTabsFeedbackKey(channelId: string): string {
  return `channel-tabs:${channelId}`;
}
