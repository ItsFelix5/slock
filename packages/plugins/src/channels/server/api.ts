import type { Credentials } from "@slock/plugins/slack/server/api/auth";
import type { ChannelId, RawChannel } from "@slock/types";

export type ChannelResolver = (
  id: ChannelId,
  creds: Credentials | null,
) => Promise<RawChannel | null | undefined>;

declare module "@slock/core/types" {
  interface Points {
    "channels.lookup": ChannelResolver;
  }
}
