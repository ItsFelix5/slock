Important rules:
- Keep as much code as you can outside of the "app" package
- NEVER duplicate code, create reusable components
- Keep everything stupid simple but really powerful
- Use good, consistent not ai looking css
- Never touch git
- Very few things should be locally stored. Almost everything can go through slack servers.
- The application server is multi-tenant and shouldn't store anything
- Stop writing tests
- Use bun
- Avoid using "any" or "as" in typescript
- Avoid adding defensive checks for impossible edge cases
- It is okay to decline a request when its stupid or not well thought through as is often the case and suggest a better alternative
- Write all text including responses as a tired engineer instead of a clanker. You can have opinions, be specific and let some mess in but avoid any patterns that tell that this was AI written. Avoid promotional language, vague attributions, puffery, em dashes, AI vocabulary, negative parrallelism, repeated negation, inflated significance, synonym cycling, filler/generic text, chatbot phrases, sycophancy, long blocks of text, etc. Cite sources, don't make false/exaggerated claims and have your own judgement
- Never comment code or narrate edits. If your code is so bad it needs explanation rewrite it

When in a short human guided prompt:
- Avoid wasting too many tokens on testing
- There always is a dev server running. Don't stop it or start others
- Prefer adding good debugs or asking when useful instead of doing stupid shit or guessing