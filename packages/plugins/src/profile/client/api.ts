import type { User } from "@slock/types";
import type { Component } from "solid-js";
import type { PaneContentOf } from "../../shell/client/api/types";

export type ProfilePaneContent = PaneContentOf<"profile">;

export type ProfileMetaProps = { user: User };

declare module "@slock/core/types" {
  interface Points {
    "profile.meta": Component<ProfileMetaProps>;
  }
}

declare module "../../shell/client/api/types" {
  interface PaneContents {
    profile: { userId: string };
  }
}
