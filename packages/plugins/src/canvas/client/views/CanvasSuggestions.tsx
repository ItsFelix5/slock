import ComposerSuggestPopover from "@slock/plugins/composer/client/api/editor/ComposerSuggestPopover";
import type { createSuggestionController } from "@slock/plugins/composer/client/api/editor/suggestionController";
import {
  type SuggestState,
  suggestOpen,
} from "@slock/plugins/composer/client/api/editor/suggestTypes";
import { FloatingPanel } from "@slock/ui";
import type Quill from "@slock/ui/editor/quill";
import { Show } from "solid-js";
import { lineElement } from "../lib/canvasCommandContext";

export default function CanvasSuggestions(props: {
  controller: ReturnType<typeof createSuggestionController>;
  popoverRef: (element: HTMLDivElement) => void;
  quill: Quill | undefined;
  state: SuggestState | null;
}) {
  return (
    <Show when={suggestOpen(props.state) ? props.state : undefined}>
      {(state) => (
        <Show when={props.quill}>
          {(quill) => (
            <FloatingPanel anchor={() => lineElement(quill())} open>
              <ComposerSuggestPopover
                floating
                onHover={props.controller.setActiveSuggestion}
                onPick={props.controller.applySuggestion}
                ref={props.popoverRef}
                state={state()}
              />
            </FloatingPanel>
          )}
        </Show>
      )}
    </Show>
  );
}
