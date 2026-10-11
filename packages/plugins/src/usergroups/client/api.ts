import type { createUsergroupsSlice } from "./store";

declare module "@slock/core/types" {
  interface Services {
    usergroups: ReturnType<typeof createUsergroupsSlice>;
  }
}
