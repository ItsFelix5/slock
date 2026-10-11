import type { RawUser } from "@slock/types";
import type { Credentials } from "../../slack/server/api/auth";

export type UserDecorator = (
  user: RawUser,
  creds: Credentials | null,
) => Record<string, unknown> | undefined;

declare module "@slock/core/types" {
  interface Points {
    "users.decorate": UserDecorator;
  }
}
