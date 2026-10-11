import type { RawChannel } from "@slock/types";
import type { Credentials } from "../../slack/server/api/auth";

export type ChannelResolver = (
  id: string,
  creds: Credentials | null,
) => Promise<RawChannel | null | undefined>;

declare module "@slock/core/types" {
  interface Points {
    "channels.lookup": ChannelResolver;
  }
}
