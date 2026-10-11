The codebase is split between packages:
- core: The plugin host (points, services, lifecycle, `Slot`). Knows nothing about Slack
- plugins: Every feature, one folder per plugin with `server/` and `client/` halves.
- app: The entry point and global CSS. It boots the host
- server: Loads server plugins and serves them. This is multi tenant and shouldn't store *anything* unless explicitly requested
- types: Type declarations only. No runtime code
- slack: The Slack API client, session, wire mappers and rich text helpers shared by plugins and blockkit
- ui: Reusable ui components
- blockkit: A block kit renderer
When writing code consider in which package it should go. New features are plugins, never edits to a host's list of features.
Physically reduce surface between all parts of the codebase to keep code clean and reduce different code paths doing the same but with different bugs.
Very few things should be locally stored. Almost everything can go through slack servers.

## Plugins
The app has no domain of its own. The installed plugins decide what it is. Slack is one plugin set, so host code (`core`, `server`, `shell`) never names Slack concepts.
A plugin is `packages/plugins/src/<id>/` with `plugin.json` (`id`, `name`, `requires`), `server/index.ts` and `client/index.tsx`. Each half default exports `setup(ctx)`. Folders are found by scan, so there is no list to edit.
- Services: `ctx.provide("x", store)` to own one, `service("x")` to read one. `service` is a lazy proxy, so call it at module scope. Never import another plugin's store or keep module level state. Wrap class instances (like `QueryClient`) in a plain object, because the proxy breaks `#private` fields.
- Points: `ctx.add("host.point", item, { order })` contributes to another plugin, `ctx.use("point")` reads contributions to your own. Declare your points and services in your `api.ts` (or `api/`) with `declare module "@slock/core/types"`. Name them `<owner>.<thing>`. Add a point instead of calling another plugin.
- Public surface: only `api.ts` or an `api/` folder may be imported by other plugins. Everything else is private. Cross-plugin imports of private files are debt that only goes down (`scripts/pluginDebt.json`).
- `requires` lists the services a plugin reads. Run `bun scripts/checkPlugins.ts --fix` to add missing ones. It never removes any, so prune stale ones by hand. `--list` prints each cross-plugin import. Requires must not form a cycle on either side. Break a cycle with a point or by moving the call, not by dropping the check.
- State lives in the plugin that owns it, created in `setup`. Gateway events go through `realtime.handler` (`gatewayHandler(types, run)`). Release things with `ctx.onCleanup`. Account switch and logout call `host.restart()`, which must leave nothing behind.
- A plugin that cannot run yet throws `Unavailable` from `setup`. It is blocked quietly with its dependents (`bootstrap` does this until an account is connected).
- Server: requests pass through the `http` point (middleware `(c, next) => Response | undefined`, higher `order` is outer). Use `route`/`routes` from `slack/server/api/router`. A plugin can wrap another one's route with `next()`. Other server points: `ws`, `cli`, `bootstrap.part`, `realtime.event`, `realtime.trim`, `users.decorate`, `channels.lookup`. Env: `SLOCK_DISABLE=a,b`, `SLOCK_PLUGINS=<dir>`, `PORT`.
- Operator plugins live in `plugins/<id>/` (`SLOCK_PLUGINS`) and import the Slack layer as `@slock/plugins/slack/<module>` and `@slock/plugins/http/<module>`. A client plugin is built with `bun run plugin:build <src> <out.js>` (see `examplePlugin`). Put the output at `plugins/<id>/client/index.js`, or add it in Settings, Plugins. It exports `manifest` and a default `setup`. The build marks `solid-js`, `@slock/*` and `@tanstack/solid-query` external.
- Contributions: settings tabs, sidebar nav, message menus and bars, composer sources, pane kinds and shell blockers are all points. Grep `declare module "@slock/core/types"` to list them.
- Panes: a plugin declares its content by merging into `PaneContents` (`shell/client/api/types`), registers `shell.pane`, and `shell.default` picks the first view. Open messages and threads through the `message-links` service.
- Where things live: `shell` (panes, URL, root layout; domain free), `conversations` (channel and dm views, message targets, `conversations.kind` and `conversations.opened` points), `bootstrap` (workspace load), `query` (QueryClient), `feedback` (toasts, undo), `blockkit` (resolver), `users`, `presence`, `dms`, `channels`, `unread`, `messages`, `realtime`. Slack client calls are in `slack/client/api`.

## Rules
- `bun check` runs biome, `tsc -b`, `scripts/checkPlugins.ts` (ids, requires, cycles, debt, file sizes). They must always pass. `packages/core` has tests (`bun test` there)
- Query keys, optimistic updates and server state belong in the query cache. Define keys with `defineKey` from `query/client/api`. Caches of fetched data use `query.client.fetchQuery`, so a restart clears them. `bun check` rejects `createResource`, literal `queryKey: [`, module level `createRoot` and library packages importing plugins. UI state outside `setup` (pending files, scroll anchors, drafts) is reset by its owner through `ctx.onCleanup`.

## Known gaps

- `packages/types`, `packages/slack` and `packages/blockkit` are Slack-shaped.
- `account` and `bootstrap` call `isConfigured()` from `@slock/slack`. A generic session service should replace it.
- `slack/server/api/router.ts` puts `creds` on every route context, and the entity trims sit in `slack/server/api/trim` instead of next to their plugins.
- No contract or validation at the Slack edge (valibot is not installed).
- Assert non-null with `defined()` from `@slock/core`. `noUncheckedIndexedAccess` is on and biome bans `!`.
