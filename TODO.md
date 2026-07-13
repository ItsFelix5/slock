- Mpdm
- Like these things popping out the sections
- threads in activity
- canvas
- video player
- dms ping
- Dates
- Move dms
- search.autocomplete has search history ({suggestions:{text[]}}) and

Done this round:
- channel tabs: was fully built but stub-disabled (`<Show when={channelId() && false}>` in ChannelHeader.tsx) — this is what "fix wtf claude did with feedback" was about, the tabs' InlineFeedback was unreachable. Flipped the gate on.
- invalidate typing after message: typing indicators only expired via a 4s TTL, so "X is typing" could linger after their message already landed. Added typing.clearTyping, called from realtime's incoming-message handler.
- "You aren't a member of D0BHHDXTECQ in activity": openChannelPeek always opened DM ids as `{kind: "channel"}`, so the join-channel bar wrongly fired for DMs opened from Activity/Later. Now checks dmById first.
- markMessageUnread rolled the *entire* channel unread (cursor to epoch 0) instead of just the target message when that message wasn't in the loaded history (e.g. opened from search/Activity) — idx -1 was being treated the same as idx 0.
- tsc -b now passes clean (was never actually run post-dependency-install; fixed a real Composer.tsx type error and a tsconfig include gap for icons.json). biome formatting also cleaned up.

Known but not fixed (needs a design call, left alone to avoid a risky blind fix):
- packages/app/server relay: watched channels/threads are only ever added, never removed (unwatch_channel is never sent by the client, and switching threads directly via openThread doesn't unwatch the previous one) — the fallback-poll set can only grow for the life of a connection.
- Several files are over the 300-line CLAUDE.md limit (relay-core.ts, Sidebar.tsx, Composer.tsx, store/index.ts, richtext.ts, blockCommands.ts, messages.ts, UserProfile.tsx, MessageRows.tsx, channels.ts, ChannelHeader.tsx, MessageSearchView.tsx, GlobalSearch.tsx, theme.ts, realtime.ts) — worth splitting up but risky to do blind/unreviewed in one pass.