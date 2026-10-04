import {
  useCancelShortcut,
  useConfirmShortcut,
  useNavigationShortcuts,
  useShortcut,
} from "@slock/ui";
import type { createSuggestionController } from "./suggestionController";
import { type SuggestState, suggestOpen } from "./suggestTypes";

export function useSuggestShortcuts(options: {
  setSuggest: (value: SuggestState | null) => void;
  suggest: () => SuggestState | null;
  suggestions: ReturnType<typeof createSuggestionController>;
}) {
  const { setSuggest, suggestions } = options;
  const shared = {
    allowInInputs: true,
    enabled: () => suggestOpen(options.suggest()),
    manual: true,
  } as const;
  const apply = () => suggestions.applySuggestion();

  useNavigationShortcuts({
    ...shared,
    directions: ["down", "up"],
    move: (direction) => suggestions.moveActiveSuggestion(direction === "down" ? 1 : -1),
  });
  useNavigationShortcuts({
    ...shared,
    directions: ["left", "right", "start", "end"],
    move: () => setSuggest(null),
    passthrough: true,
  });
  useConfirmShortcut(apply, shared);
  useCancelShortcut(() => setSuggest(null), shared);
  useShortcut({
    ...shared,
    combo: { key: "Tab" },
    handler: apply,
    id: "composer.applySuggestionTab",
    label: "Insert the highlighted suggestion with Tab",
    scope: "composer",
    group: "Message box",
  });
}
