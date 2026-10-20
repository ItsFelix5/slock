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
Host code (`core`, `server`, `shell`) never names Slack concepts. Slack is just one plugin set.

A plugin is `packages/plugins/src/<id>/` with `plugin.json` (`id`, `name`, `requires`), `server/index.ts` and `client/index.tsx`. Each half default exports `setup(ctx)`. Folders are found by scan.

- **Services:** `ctx.provide("x", store)` owns one, `service("x")` reads one. Call `service` at module scope. Never import another plugin's store or keep module level state. Wrap class instances in a plain object.
- **Points:** `ctx.add("host.point", item, { order })` contributes, `ctx.use("point")` reads. Declare both in `api.ts` with `declare module "@slock/core/types"`, named `<owner>.<thing>`. Add a point instead of calling another plugin.
- **Imports:** other plugins may only import `api.ts` or `api/`.
- **requires:** services a plugin reads. `bun scripts/checkPlugins.ts --fix` adds missing ones, you prune stale ones. No cycles. Break them with a point.
- **Lifecycle:** state is created in `setup`. Release with `ctx.onCleanup`. `host.restart()` on account switch must leave nothing behind. Throw `Unavailable` from `setup` if the plugin can't run yet.
- **Server:** requests go through the `http` point. Use `route`/`routes` from `slack/server/api/router`. Wrap another plugin's route with `next()`.
- **Panes:** merge into `PaneContents` and register `shell.pane`. Open messages through `message-links`.
