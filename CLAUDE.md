Important rules:

- Keep as much code as you can outside of the "app" package
- NEVER duplicate code, create reusable components
- Simplicity is good but keep it powerful
- Use good, consistent not ai looking css
- Don't mess with dev servers (there always is one running) or chromium only to test if it works
- Never touch git
- Very few things should be locally stored. Almost everything can go through slack servers.
- The application server is multi-tenant and shouldn't store anything
- Prefer adding debugs that tell you _important information_ (don't debug to debug, prefer using the knowledge you already have) when that helps or ASKING instead of doing stupid shit or guessing data based on nothing.
- Stop writing tests
- Comment only when you are recording something genuinely valuable that the code cannot convey by itself, so writing none is the default. Never narrate edits.
- When a comment grows past a sentence or two, stop and reconsider whether it earns its place, because it usually does not. The rare exception is a short block that captures knowledge someone would otherwise have to rediscover painfully, for example why a workaround is required by some external constraint.
- Keep the mechanics casual: lowercased, US-keyboard characters only, punctuation kept to a minimum, no trailing period, closer to a jotted note than a wrapped paragraph.
- Use bun
