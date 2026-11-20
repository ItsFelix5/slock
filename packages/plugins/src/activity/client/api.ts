export { hasChannel } from "./kinds";
export { TAG_FILTERS } from "./views/activityViewFilters";

import type { Component } from "solid-js";
import type { createActivityStore } from "./store";
import type { ActivityRow } from "./views/ActivityRow";

export type ActivityMenuProps = {
  row: ActivityRow;
  close(): void;
};

declare module "@slock/core/types" {
  interface Points {
    "activity.menu": Component<ActivityMenuProps>;
  }
  interface Services {
    activity: ReturnType<typeof createActivityStore>;
  }
}
