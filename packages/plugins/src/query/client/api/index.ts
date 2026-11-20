/**
 * Query layer: keyed, cached async data built on `@slock/resource`.
 *
 * The `query` service exposes `{ hub, persist }`: the plugin's `ResourceHub` (120s gc, retry policy
 * from `retryPolicy.ts`, idle eviction, cleared on cleanup) and the IndexedDB persistence adapter
 * of the active account.
 *
 * `defineQuery({ name, load, maxAgeMs?, gcMs?, retry?, persist? })` creates one cache and returns a handle. Call it
 * at module scope or in `setup`; the cache binds lazily to the live hub, so handles survive
 * `host.restart()` without module state. `Arg` is the cache key (hashed
 * structurally); `undefined` means "disabled", so argless queries use `null` as their arg.
 *
 * Imperative: `ensure(arg)` (cached or fetch), `refresh(arg)` (always fetch), `invalidate(arg)`,
 * `invalidateAll()`, `invalidateWhere(match)`, `set(arg, data)`, `patch(arg, update)` -> undo, `modify(arg, update)` (patch only when data is cached),
 * `remove(arg)`, `read(arg)` (plain cache read, not reactive), `restore()`.
 *
 * Solid hooks: `use(() => arg | undefined)` is a suspending accessor (stale data when present,
 * otherwise a promise for `<Loading>`, failures for `<Errored>`, `isPending()` while refetching);
 * `state(() => arg | undefined)` is the non-suspending `EntryState` accessor
 * (`status`, `data`, `error`, `refreshing`, `stale`); `peek(arg)` / `entry(arg)` are synchronous
 * reactive reads for use in stores and derived state, which start a fetch when nothing is cached.
 *
 * `createLatestValueSync` coalesces writes to the newest value; `shouldRetry` is the shared
 * transient-failure test for hand-rolled retries.
 */
import type { PersistAdapter, ResourceHub } from "@slock/resource";

export { retryPolicy, shouldRetry } from "../retryPolicy";
export { createLatestValueSync } from "./latestValueSync";
export {
  defineQuery,
  type Query,
  type QueryDefinition,
  type QueryPersistence,
} from "./defineQuery";

declare module "@slock/core/types" {
  interface Services {
    query: { hub: ResourceHub; persist: PersistAdapter };
  }
}
