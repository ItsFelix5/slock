import type { IconName } from "@slock/ui";

export type ChannelTabType = "pinned";

export const ADDABLE_CHANNEL_TABS: {
  type: ChannelTabType;
  label: string;
  icon: IconName;
}[] = [{ icon: "pin-filled", label: "Pinned", type: "pinned" }];
