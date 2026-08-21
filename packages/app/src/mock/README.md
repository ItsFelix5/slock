# Offline test mode (temporary)

Lets you click through the app with fake data and no Slack connection at
all - built for testing this branch's changes while the sandbox couldn't
reach a real workspace. Delete this whole folder plus the small hook in
`../index.tsx` once you don't need it anymore.

## Use it

```
bun run dev
```

then open `http://localhost:5173/?mock=1`. That query param is the only
trigger - `index.tsx` checks for it before the real `isConfigured()` check
and, if present, installs the mock and skips straight past the connect
screen.

## What it actually does

`mockApi.ts` patches `window.fetch` (intercepting `/api/*` only - anything
else goes through untouched) and `window.WebSocket` (a fake socket that
just reports itself connected; it doesn't push real-time events, so
presence_sub/live-message-arrival can't be exercised this way - only
things reachable via a request/response). Everything reads from and
writes to in-memory state seeded from `fixtures.ts`, so reactions,
pins, edits, mute, topic/purpose/name changes, etc. actually persist for
the session, they just reset on reload.

It deliberately does NOT cover every endpoint the real server has -
unhandled routes soft-fail to `{ok: true}` rather than erroring, so one
missing route doesn't break everything else. If something you want to
test comes back empty, it's probably just not wired up in `mockApi.ts`
yet - add a handler following the existing pattern (`on(method, pattern,
handler)`), matching the real route's shape in
`packages/server/src/routes/`.

## What's in the fixtures

Five channels (one with a canvas tab, one archived, one with 60 messages
for scroll/pagination testing), two 1:1 DMs, one group DM, six users with
mixed presence. Message content deliberately exercises this session's
changes: bold/italic/strike/code/blockquote/bullet list, `<!channel>` and
`<!date^...>` tokens, a bot message with its own icon/name plus a
`source_user_id` (hover the avatar vs the APP badge), reactions, an
edited message, unread counts on a few conversations (for the sidebar
edge indicator + pill tooltip).

## Removing it

1. Delete `packages/app/src/mock/`.
2. In `packages/app/src/index.tsx`, delete the `mock` query-param block at
   the top of `main()` (clearly commented, right before the
   `isConfigured()` check).
