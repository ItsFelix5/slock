The codebase is split between packages:
- core: The plugin host and API, the client `boot` and the server `serve`. Knows nothing about Slack. The server is multi tenant and shouldn't store *anything* unless explicitly requested
- plugins: Every feature, one folder per plugin with `server/` and `client/` halves.
- types: Type declarations only. No runtime code
- slack: The Slack API client, session, wire mappers and rich text helpers shared by plugins and blockkit
- ui: Dumb reusable UI components and app could use
- blockkit: A block kit renderer
- resource: The data engine
- installer: `bun plugin`. Fetches, builds and links plugins into an instance dir and confirms every action first. The only code that reads plugin source on behalf of an admin
- central: A standalone Bun service every slock instance can talk to, with its own SQLite database. Not part of the app bundle. One folder per feature (`relay` performs actions for Slack users from signed slash commands, `settings` stores slock settings per workspace and user). A feature is a `Handler` plus its own migrations through `migrate`, and is mounted in `index.ts`. Unlike `core` it is allowed to store what its features need
- test/ (repo root): every test, fake, mock and test helper, never anywhere else. `test/<package>/` per package, shared fakes in `test/support/`
Client and server never import each other. Browser code goes in a `client/` folder, server code in a `server/` folder, and everything else is shared and imports neither. `ui`, `blockkit` and `resource` are client, `installer` and `relay` are server. `checkSource` enforces this.
When writing code consider in which package it should go. New features are plugins, never edits to a host's list of features.
A plugin only holds what its own feature needs. A helper with one consumer lives with that consumer, so the `slack` package and plugin keep only what is shared.
Physically reduce surface between all parts of the codebase to keep code clean and reduce different code paths doing the same but with different bugs.
Very few things should be locally stored. Almost everything can go through slack servers.
Internal Slack endpoints return `{"ok":true}` even when they ignore your params. Copy the real web client's request instead of guessing.