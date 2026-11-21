import type { Credentials } from "@slock/plugins/slack/server/api/auth";
import type { RawUser } from "@slock/types";

export type UserDecorator = (
  user: RawUser,
  creds: Credentials | null,
) => Record<string, unknown> | undefined;

declare module "@slock/core/types" {
  interface Points {
    "users.decorate": UserDecorator;
  }
}
