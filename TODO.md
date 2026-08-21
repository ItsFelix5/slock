Ready to implement:
- viewing online status of others that works (figure out how slack does this)
- ctrl+z on everything that makes sense
- unread channel further down/up indicator in sidebar
- unread message info (amount, since, etc in the pill on hover?) 
- just rework the composer to be good instead of borderline usable. This includes good autocomplete, the message rendering like it would sent and all block kit bits that would have a usecase being usable. Keyboard first. Just typing :hs: should insert that emoji. --- a horizontal line (cursor can be in weird spots, not good), ## a h2 (doesn't work rn), etc.
- Clear channel settings committing instead of maybe updating
- Canvases don't appear in header nor open properly, this should be tested to work well
- Search history from slack (find where its stored)
- Channel pings through bots don't render the <!channel> as a mention in activity and don't have the custom pfp/"icon"
- if metadata.event_payload.source_user_id is set on a message change hovering over a username/pfp show that but hovering over [APP] still shows the app
- Clean up code and try to minimize surface between logic and ui by introducing hard boundries so all logic is forced through consistent paths instead of similar things behaving differently, also attempt to deduplicate code and abstract into common components
- Fucking damn it scroll jumping is back when loading new shit.
- Prevent infinite loading loops when scrolling down from far up
- Prevent channel names from wrapping and truncate them
- Allow dragging message *items* or channels or whatever to the right to open them as a new split separate from the "main" split where threads auto close and stuff.

To design/blocked
- quick search plain sucks (from, with, in, has, is, during, type, hasmy)
- catch up
- check keyboard a11y & split UX
- reaction images/templates
- make activity triage over recall and later issue tracking over a list
- canvas editing
- glance
- better context switching when active in multiple threads
- Collapse views when they get too narrow and then maybe add tabs or smth?