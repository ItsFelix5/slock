This is a react clone written in solid using bun.

Project structure:
- packages/ui: reusable components, if you think its possible to put something here you should
- packages/blockkit: A simple slack block kit renderer
- packages/slack-api: sdk for interfacing with slacks internal api which we use
- packages/app: The main app tying everything together

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