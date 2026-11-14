import type { createSearchStore } from "./store";

export { default as SearchQueryInput } from "./views/SearchQueryInput";

declare module "@slock/core/types" {
  interface Services {
    search: ReturnType<typeof createSearchStore>;
  }
}
