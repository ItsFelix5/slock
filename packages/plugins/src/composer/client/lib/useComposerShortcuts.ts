import { focusedPaneId, focusPaneById, useEscapeClose, useShortcut } from "@slock/ui";
import type Quill from "@slock/ui/editor/quill";

export function useComposerShortcuts(deps: {
  dismissPreviews: () => void;
  editing: () => boolean;
  focusEditor: () => void;
  hasPreviews: () => boolean;
  paneId: () => string | undefined;
  quill: () => Quill | undefined;
  toggleDrafts: () => void;
}) {
  const paneFocused = () => !deps.editing() && !!deps.paneId() && focusedPaneId() === deps.paneId();
  useShortcut({
    combo: { key: "i" },
    enabled: paneFocused,
    handler: deps.focusEditor,
    id: "composer.focus",
    label: "Focus the message box",
    scope: "composer",
    group: "Message box",
  });
  useShortcut({
    allowInInputs: true,
    combo: { alt: true, key: "d", mod: true },
    enabled: paneFocused,
    handler: deps.toggleDrafts,
    id: "composer.drafts",
    label: "Browse saved drafts",
    scope: "composer",
    group: "Message box",
  });
  useShortcut({
    allowInInputs: true,
    combo: { alt: true, key: "p", mod: true },
    enabled: () => paneFocused() && deps.hasPreviews(),
    handler: deps.dismissPreviews,
    id: "composer.dismissPreviews",
    label: "Remove link previews",
    scope: "composer",
    group: "Message box",
  });
  useEscapeClose(
    () => {
      const id = deps.paneId();
      if (id) focusPaneById(id);
    },
    () => !deps.editing() && document.activeElement === deps.quill()?.root,
  );
}
