The codebase is split between packages:
- core: The plugin host (points, services, lifecycle, `Slot`). Knows nothing about Slack
- plugins: Every feature, one folder per plugin with `server/` and `client/` halves.
- app: The entry point and global CSS. It boots the host
- server: Loads server plugins and serves them. This is multi tenant and shouldn't store *anything* unless explicitly requested
- types: Type declarations only. No runtime code
- slack: The Slack API client, session, wire mappers and rich text helpers shared by plugins and blockkit
- ui: Reusable ui components
- blockkit: A block kit renderer
- resource: The cache engine (`createResourceCache`, hub, dedupe, cooldown, retry, persistence) and its Solid readers in `@slock/resource/solid`. No Slack, no DOM. Plugins use it through `defineQuery` from `query/client/api` (the `query` plugin)
- relay: A small standalone Bun service that verifies Slack signed requests and performs actions. Not part of the app bundle
- `examplePlugin/` (repo root): a minimal external plugin, built and loaded by a test
When writing code consider in which package it should go. New features are plugins, never edits to a host's list of features.
Physically reduce surface between all parts of the codebase to keep code clean and reduce different code paths doing the same but with different bugs.
Very few things should be locally stored. Almost everything can go through slack servers.
Internal Slack endpoints return `{"ok":true}` even when they ignore your params. Copy the real web client's request instead of guessing.
Fix any issue you come across without asking

## Plugins
Host code (`core`, `server`, `shell`) never names Slack concepts. Slack is just one plugin set.

A plugin is `packages/plugins/src/<id>/` with `plugin.json` (`id`, `name`, `requires`), `server/index.ts` and `client/index.tsx`. Each half default exports `setup(ctx)`. Folders are found by scan.

- **Services:** `ctx.provide("x", store)` owns one, `service("x")` reads one (`ctx.get("x")` inside `setup`). `service`, `maybeService`, `usePoint`, `Slot` and `createFlags` come from `@slock/core/solid`. Call `service` at module scope. Never import another plugin's store or keep module level state. Wrap class instances in a plain object.
- **Points:** `ctx.add("owner.point", item, { order })` contributes, `ctx.use("owner.point")()` reads the live list. Declare services and points in `api.ts` with `declare module "@slock/core/types"` under `Services` and `Points`, named `<owner>.<thing>`. Add a point instead of calling another plugin.
- **requires:** `bun scripts/checkPlugins.ts --fix` adds missing ones, you prune stale ones. Break cycles with a point.
- **Lifecycle:** state is created in `setup`. Release with `ctx.onCleanup`. `host.restart()` on account switch must leave nothing behind. Throw `Unavailable` from `setup` if the plugin can't run yet.
- **Server:** requests go through the `http` point. Use `route`/`routes` from `slack/server/api/router`. Wrap another plugin's route with `next()`.
- **Panes:** merge into `PaneContents` and register `shell.pane`. Open messages through `message-links`.

## Writing a plugin
Start from `examplePlugin/`; `packages/plugins/test/plugins/examplePlugin.test.ts` builds and loads it, so it cannot rot.
- **Manifest:** `plugin.json` is `{ id, name, requires }` (`id` is lowercase letters, digits and `-`; `provides`, `core`, `hidden`, `defaultEnabled` are optional). `parseManifest` from `@slock/core` is the one validator and returns every error. An external client plugin exports the same object as `manifest`, plus `css` (a string) and a default `setup`.
- **Imports:** only `@slock/core`, `@slock/core/solid`, `@slock/ui`, `@slock/slack`, `@slock/blockkit`, `solid-js`, `@solidjs/web`. The host serves one pinned copy through the import map and the build leaves them external. Never bundle your own Solid.
- **Build:** `bun run plugin:build <entry.tsx> <out.js>`.
- **setup(ctx):** runs once per start. Create state here, never at module scope. Return a promise for async work, or throw `Unavailable` to retry later.
- **Cleanup:** `ctx.onCleanup(fn)` for timers, listeners and sockets. Use `service("env")` for time, timers, storage, random and fetch.
- **Halves:** `client/index.tsx` runs in the browser, `server/index.ts` in the multi tenant server. They share nothing but HTTP routes, so put shared types in `@slock/types`.
- **Solid 2:** `createSignal`, `createMemo`, `createStore` and `createEffect(compute, apply)` come from `solid-js`; `render` and the JSX runtime from `@solidjs/web`. Async data is an async memo read under `<Loading>` and `<Errored>`; show stale data with `latest()`, refetch with `refresh()`, write with `action(function*(){ yield ... })` and `createOptimistic`. Do not use `createResource`, `Suspense`, `ErrorBoundary`, `batch`, `on`, `produce`, `unwrap`, `Dynamic`, `Index`, `classList`, `splitProps` or `mergeProps`.
- **Data idioms:** server data goes through `defineQuery({ name, load, persist? })` (`use`, `ensure`, `patch`, `invalidate`), not hand rolled caches. A list with optimistic writes is `createOptimisticStore(asyncFn, initial, { key })` changed inside `action(function*(){ setX(draft => ...); yield request(); yield refresh(store) })` (see `later/client/store.ts`). `createFlags<Key>()` is a keyed boolean store. `createPref(env.storage, { key, fallback, parse })` from `@slock/core` is the only local persistence (sync `get`/`set`/`onRemoteChange`); plugins wrap it as `createLocalPref`.

## Checks and tests
`bun run check` runs biome, `tsc -b`, `scripts/checkPlugins.ts`, `scripts/checkPackages.ts` (each package.json lists exactly what the package imports, src imports are `dependencies`, no workspace cycles, tsconfig references match) and `scripts/checkSource.ts`. The source rules (`--list` shows locations) fail on: `no-cast` (`as` except `as const`), `no-any`, `empty-catch`, `switch-without-default`, `raw-env` (`fetch`, timers, `Date.now`, `new Date()`, `Math.random`, `localStorage` outside `core/env.ts` and `relay`; use `service("env")`), `module-state` (top level `let`, `createSignal`, `createStore`, `createRoot` in `src`), `removed-solid-api`, `file-size` (over 300 lines, tests included), `test-support-in-src` (no `testing` or `test/` imports from `src`) `suppression` (`biome-ignore`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`), `effect-apply-returns` (an effect apply returning a value) and `write-in-compute` (a signal or store setter reached synchronously, before the first `await`, from a `createMemo`/`createEffect` compute or a JSX expression; write in an apply, an event handler or after an await, or make the signal `ownedWrite`). Rule tests live in `scripts/test/`.

Run tests with `bun run test` (`bun test --conditions browser --conditions development`; without the flags Solid loads its SSR build). `createFakeEnv` from `@slock/core/testing` fakes time, timers, storage, fetch and random; the module also has `forAll`, `seededRandom` and `inRoot`. Slack store tests use `createStoreHarness` and `createFakeSlack` (`plugins/test/messages/client/store/`). Fuzz suites run through `plugins/test/fuzz/fuzzRun.ts` (`FUZZ_SEED`, `FUZZ_SEEDS`). `test/preload.ts` fails any test that triggers `STRICT_READ_UNTRACKED` or `REACTIVE_WRITE_IN_OWNED_SCOPE`: read signals in an effect's compute function, or wrap event-handler reads in `untrack`.

## Overlays
Modals, panes and cards clip their children (`overflow: hidden` or scroll). Never position a dropdown, picker or popover with `position: absolute` inside one: it gets cut off or adds a scrollbar. Use `FloatingPanel` (via `Popover`, `Menu` or `Combobox` from `@slock/ui`), which portals into the nearest overlay. Pick people or channels in a dialog with `Combobox`. `ComposePicker` is absolute and only for the composer. Check that a new popup opens inside a dialog without clipping or scrolling it.
