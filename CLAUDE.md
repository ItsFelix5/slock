The codebase is split between packages:
- app: The main web app handling logic, split between lib (logic) and components (dumb interfaces). Keep these separate.
- server: The server handling requests between our app and slack. This is multi tenant and shouldn't store *anything* unless explicitly requested
- types: Lots of type declarations
- ui: Reusable ui components
- blockkit: A block kit renderer
When writing code consider in which package it should go. Avoid app if possible.
Physically reduce surface between all parts of the codebase to keep code clean and reduce different code paths doing the same but with different bugs.
Very few things should be locally stored. Almost everything can go through slack servers.