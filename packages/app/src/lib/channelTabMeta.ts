import type { IconName } from "@slock/ui";

// Metadata for optional per-channel shortcuts saved in user preferences.
// Canvas is deliberately separate: its compact header menu reflects the
// channel's real Slack canvas instead of pretending it is a local preference.
export type ChannelTabType = "pinned";

export const ADDABLE_CHANNEL_TABS: { type: ChannelTabType; label: string; icon: IconName }[] = [
  { icon: "pin-filled", label: "Pinned", type: "pinned" },
];

// Keep tab-sync feedback separate from general channel actions so one cannot
// replace the other while both are in flight.
export function channelTabsFeedbackKey(channelId: string): string {
  return `channel-tabs:${channelId}`;
}
