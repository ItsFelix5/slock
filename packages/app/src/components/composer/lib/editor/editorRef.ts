// The contentEditable DOM node itself, shared by selectionCommands.ts and
// blockCommands.ts (both need to read it; only the component's JSX ref
// callback ever writes it) — a tiny mutable handle instead of a module-level
// `let` so each Composer instance gets its own.
export function createEditorRef() {
  let el: HTMLDivElement | undefined;
  return {
    get: () => el,
    set: (next: HTMLDivElement | undefined) => {
      el = next;
    },
  };
}

export type EditorRefHandle = ReturnType<typeof createEditorRef>;
