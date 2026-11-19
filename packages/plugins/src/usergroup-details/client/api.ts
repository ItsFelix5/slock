import type { Component } from "solid-js";
import type { PaneContentOf } from "../../shell/client/api/types";

export type UsergroupDetailsPaneContent = PaneContentOf<"usergroup-details">;

export type UsergroupHoverProps = { usergroupId: string; close(): void };

declare module "@slock/core/types" {
  interface Points {
    "usergroup-details.hoverAction": Component<UsergroupHoverProps>;
  }
  interface Services {
    "usergroup-details": ReturnType<typeof import("./usergroupDetails").createUsergroupDetails>;
  }
}

declare module "../../shell/client/api/types" {
  interface PaneContents {
    "usergroup-details": { usergroupId: string };
  }
}
