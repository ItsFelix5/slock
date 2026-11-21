import type { PaneContentOf } from "@slock/plugins/shell/client/api/types";
import type { User, UserId } from "@slock/types";
import type { Component } from "solid-js";

export type ProfilePaneContent = PaneContentOf<"profile">;

export type ProfileMetaProps = { user: User };

declare module "@slock/core/types" {
  interface Points {
    "profile.meta": Component<ProfileMetaProps>;
  }
}

declare module "../../shell/client/api/types" {
  interface PaneContents {
    profile: { userId: UserId };
  }
}
