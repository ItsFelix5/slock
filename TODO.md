- [x] Add non pinging mentions — this actually meant: typing @alice should insert a chip that renders like a link to her profile, not a highlighted "ping" style. The rendered message view (blockkit's Mention component) was already correct; the real bug was that composer chips (mention/channel/date/emoji) had zero CSS anywhere, so they showed as bare unstyled text while composing. Fixed — chips now match the rendered non-pinging @mention/#channel style.
- [x] Pingwords — custom keywords that ping like an @mention wherever they appear, even in channels you'd get no other activity from. Uses the same real users.prefs mechanism as muted_channels (highlight_words). Settings > Notifications has add/remove UI.
- Improve channel notification settings (every thread, broadcast) — still just mute + notify-all; needs research into what granularity the internal Slack API actually exposes before building more.
- [x] Activity improvements — merged in what a separate DMs/Threads tab would otherwise cover: thread groups show the root message for context plus an expandable oldest-first reply list (not just an avatar stack + count), and rows now show "you reacted" / "you replied" badges (best-effort, from whatever's already loaded) plus a new client-side "mark as complete" personal triage toggle.
- [x] Fix the notification system — fixed several real bugs (mark-as-read wasn't advancing the read cursor, sidebar unread dot ignored boot state, rejoining a channel stayed hidden, mute persistence had no error handling) and added desktop/OS notifications (Settings > Notifications), which didn't exist at all before. Still no sound.
- Anything else that is required to make this better than slack / Improve UI/UX/QoL — see suggestions below, not yet implemented.
- [x] Mark all as read (Activity view) now only marks whatever's currently filtered/visible, not every activity item ever loaded.
- [x] Search history — MessageSearchView remembers recent queries (empty-state list, click to rerun, per-entry remove, clear all) and "marked as complete" now uses a real ✅ reaction instead of client-only state. Both, plus the desktop-notifications-enabled toggle, are synced through the same real users.prefs blob as mute/pingwords (custom keys, since the underlying setting isn't a native Slack concept) instead of localStorage.

## Ideas for "better than Slack" / UI-UX-QoL (not yet implemented)

- **Command palette**: Cmd+K currently opens search; could grow into a real
  command palette (jump to channel/DM, run actions like "mute this channel",
  "toggle theme") the way Linear/Raycast do it — search already has the
  fuzzy-match infra this would reuse.
- **Saved/named searches**: recent-query history now persists (see above);
  a further step would be letting you name and pin a specific query+filter
  combo ("my open PRs channel", "unresolved bugs") rather than just the last
  15 free-text queries.
- **Bulk activity triage**: "mark all as read" exists, but nothing like
  "mark all reactions as read, keep mentions" or multi-select on Activity
  rows — the new pinging/ambient filter is a step toward this but a real
  bulk-select would go further than Slack's Activity tab does.
- **Thread digest / "catch me up"**: for a thread with dozens of replies,
  a short computed summary (who said what, in brief) before diving into the
  full list — doesn't need an LLM, could start as "N people, last reply
  from X, Y unread since your last visit."
- **Snooze a conversation**: DND snoozes notifications globally; a per-
  channel/DM "remind me about this in 2 hours" (distinct from the existing
  per-message remind) would cover the common "I'll deal with this later"
  case without losing it in Activity.
- **Offline-friendly read state**: messages/threads already cache in the
  store per session; persisting recently-viewed channels to IndexedDB would
  let the app render instantly on reload instead of waiting on bootstrap,
  and degrade more gracefully on a flaky connection.
- **Reaction leaderboard / stats**: lightweight, low-effort "fun" feature —
  most-used emoji, who reacts to you most — the kind of thing that makes a
  self-hosted client feel like *yours* rather than a clone.
- **Per-channel notification granularity** (see the item above): worth
  investigating whether the real `all_notifications_prefs` blob supports a
  "threads I'm in" tier beyond desktop/mobile "everything", since that's the
  one Slack-standard option this app doesn't yet expose.
