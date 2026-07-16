import type { IconName } from "@slock/ui";

// The only tab type a user can freely add/remove/reorder in this app's own
// tab bar. Kept to just one on purpose: things like Canvas aren't a good fit
// here — a channel can have several, so a single toggleable entry can't
// represent it — those instead just show up automatically when relevant
// (see ChannelHeader/ChannelTabsTab), never as a manual add/remove choice.
export type ChannelTabType = "pinned";

export const ADDABLE_CHANNEL_TABS: { type: ChannelTabType; label: string; icon: IconName }[] = [
  { icon: "pin-filled", label: "Pinned", type: "pinned" },
];

// Keep tab-sync feedback separate from general channel actions so one cannot
// replace the other while both are in flight.
export function channelTabsFeedbackKey(channelId: string): string {
  return `channel-tabs:${channelId}`;
}
