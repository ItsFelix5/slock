This is a slack clone written in solid using bun.

Project structure:
- packages/ui: reusable components, if you think its possible to put something here you should
- packages/blockkit: A simple slack block kit renderer
- packages/slack-api: sdk for interfacing with slacks internal api which we use (client-side only, no server/secrets in here)
- packages/app: The main app tying everything together, including the relay server (packages/app/server/)

Server architecture:
- The backend is a minimal generic relay, not a bespoke-endpoint server. packages/app/server/relay-core.ts holds the actual logic (token/cookie handling, `callSlack`, the Edge Gateway websocket) and is framework-agnostic (fetch + the `ws` package), so it runs under both Node and Bun.
- When adding a new Slack API call, add a function to packages/slack-api/src/api/*.ts that calls `callSlack()` — never add a bespoke endpoint to relay-core.ts/dev-plugin.ts/index.ts.
- Real-time events come from Slack's own Edge/Flannel gateway (`wss-primary.slack.com`), not classic RTM (permanently blocked on this Enterprise Grid workspace). This is an undocumented protocol reverse-engineered from the real web client — see relay-core.ts before touching it.

Important rules:
- A file may never be over 500 lines of code
- A folder may not have over 10 files at its root
- All UI components that don't directly interact with slack should be in the UI package
- NEVER duplicate code, create reusable components
- Simplicity is good
- Use good, consisten not ai looking css
- Don't add comments that state the obvious
- Don't mess with dev servers (there always is one running) or chromium only to test if it works
- Ask instead of giving up
- Don't mess with git
- Never fully paginate or cache an entire workspace-wide directory (channels, users, etc) server-side — always implement it as live, debounced per-query search instead
- Unread/notification/mention state is owned by Slack (`client.counts`, real per-channel read cursors) — defer to it rather than reinventing client-side "is this unread" heuristics
- Avoid toast notifications; prefer inline feedback, optimistic UI, or status shown in the relevant panel
- Solid.js: a reactive/derived value must be read as an accessor call directly at its JSX usage site (e.g. inside `<For>`) — hoisting it to a plain const captures a stale snapshot that won't update