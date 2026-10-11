import type { PaneContentOf } from "../../shell/client/api/types";

export type UsergroupDetailsPaneContent = PaneContentOf<"usergroup-details">;

declare module "@slock/core/types" {
  interface Services {
    "usergroup-details": ReturnType<typeof import("./usergroupDetails").createUsergroupDetails>;
  }
}

declare module "../../shell/client/api/types" {
  interface PaneContents {
    "usergroup-details": { usergroupId: string };
  }
}
