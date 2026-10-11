import type { Credentials } from "../../slack/server/api/auth";

export type PresenceSeen = (userId: string, creds: Credentials) => void;

declare module "@slock/core/types" {
  interface Points {
    "presence.seen": PresenceSeen;
  }
}
