import type { Credentials } from "@slock/plugins/slack/server/api/auth";
import type { UserId } from "@slock/types";

export type PresenceSeen = (userId: UserId, creds: Credentials) => void;

declare module "@slock/core/types" {
  interface Points {
    "presence.seen": PresenceSeen;
  }
}
