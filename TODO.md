- scroll jank
- responses don't seem to render correctly always <like|link text> iirc
- channel section filtering actually saving
- Implement invitations and reminders in activity
- Remove send message button
- Composer block quote deletion per line should act like a character
- You should be able to select and copy and paste composer text like you should
- Unsaving doesn't remove "Saved" indicator next to username
- Response/reply links staying on message mentions
{
              "type": "message_mention",
              "message_ts": "1785516653.774129",
              "channel_id": "C0188CY57PZ",
              "thread_ts": "1785515975.702999",
              "text": "https://hackclub.enterprise.slack.com/archives/C0188CY57PZ/p1785516653774129?thread_ts=1785515975.702999&cid=C0188CY57PZ",
              "url": "https://hackclub.enterprise.slack.com/archives/C0188CY57PZ/p1785516653774129?thread_ts=1785515975.702999&cid=C0188CY57PZ"
            },
- Feedback ux (especially the copied link/reactors sucks and changes scroll)
- Everything should be keyboard accessible, from shortcuts to ctrl+z on EVERYTHING to improving ctrl+k and making sure ctrl+/ is up to date
- Avoid optimistic updates but max ux
- channel search button should show files & links page + search bar  (conversations.searchLinks + search.modules.files?)
- groups should show up in dms section
- better uploads (previews, file name editing, things like cropping perhaps even???)
- generally improve UI/UX across the app a LOT
- clean up codebase
- better composer
- clear urls
- ?hca/ht status (ploogin?)
- user last seen
- sent to channel
- no scroll bar, but proper channel navigation (yesterday, the beginning etc)
- Couldn’t sync your read state.
- Threads in activity show more than unread, i see my own message
- I actively see a ping in a channel and a dm from Slack in my message list but its not in activity
- Initial scroll sometimes only just shows like one message and blank space under it
- Failed to sync channel read cursor Error: channel_not_found?
- add a copy button like with reactions to the members tab of a channel
- Fix Channels and usergroup sections just being expanded by default while the rest isn't
- Message compactness slider is dogshit
- Fix whatever is going on with canvases, this isn't serious
- Opening the emoji picker doesn't focus search
- Fix jumpyness in search
- Improve speed (especially network is blocking, reduce on that)