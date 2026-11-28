/**
 * Query layer: every piece of server data, every write and every list in the app goes through here.
 * Built on `@slock/resource`; the `query` service exposes `{ hub, persist }`.
 *
 * Declare at module scope or in `setup`. Handles bind lazily to the live hub, so they survive
 * `host.restart()` without module state.
 *
 * `defineQuery({ name, load, maxAgeMs?, gcMs?, retry?, persist?, revalidates? })`: one cache.
 * `Arg` is the key (hashed structurally, `undefined` disables), so a Slack id is a whole key.
 * Records are queries keyed by their id: pass a batching `load` (`createBatchLoader`), feed
 * known rows with `set`, list them with `values()`, and use `gcMs: Infinity` to keep them.
 * Refetched data keeps the references of everything that did not change (rows match by `id`/`ts`).
 *
 * Reads: `use` (suspending), `state` (`EntryState`), `peek`/`entry`/`values` (reactive, for stores).
 * An entry stays alive while a computation reads it. A load that reads `context.signal` is
 * aborted when its last reader leaves. Imperative: `ensure`, `refresh`, `invalidate`,
 * `invalidateAll`, `invalidateWhere`, `set`, `patch`, `modify`, `remove`, `read`, `restore`.
 * Use `modify` for a change the server already has: it patches cached data, and with nothing
 * cached it restarts the load, whose response may predate the change. `request` runs one more
 * load under this query's retry and cooldown.
 *
 * `definePagedQuery({ name, load(arg, cursor), itemKey })` adds `more`, `loadingMore` and
 * `moreFailed`; data is `{ items, next }` and a refetch reloads the pages already shown.
 *
 * `defineMutation({ run, optimistic?, mode?, key?, version?, settles?, onSuccess?, onError? })`:
 * `run(variables)` resolves true or false, `pending(key?)` is reactive. `optimistic` layers
 * changes over query data with `transaction.apply(query, arg, change)`; a failure removes only
 * its own layer, so changes must be safe to apply twice. Modes: `parallel` (default), `single`
 * (ignore while running), `queue` (in order per key), `latest` (only the newest value is written).
 *
 * `createTypeahead(query, { arg, delay, empty })` debounces typed text into a query: `set`,
 * `value` (keeps the previous results while the next load), `searching`, `failed` and `retry`.
 *
 * Timers come from `@slock/core` (`createDebouncer`, `createQueue`) and `useDebouncer` in
 * `@slock/core/solid`; work that must not be lost when the page closes registers with
 * `hub.onFlush`.
 */
import type { PersistAdapter, ResourceHub } from "@slock/resource";

export { retryPolicy } from "../retryPolicy";
export { createTypeahead, type Typeahead } from "./createTypeahead";
export { defineMutation } from "./defineMutation";
export { definePagedQuery, type PagedQuery } from "./definePagedQuery";
export { defineQuery, type Query } from "./defineQuery";

declare module "@slock/core/types" {
  interface Services {
    query: { hub: ResourceHub; persist: PersistAdapter };
  }
}
