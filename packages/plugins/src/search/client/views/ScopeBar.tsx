import { SegmentedControl, useShortcut } from "@slock/ui";
import { For } from "solid-js";
import type { SearchSession } from "../engine/session";
import { SCOPES, type Scope } from "../searchQuery";

const LABELS: Record<Scope, string> = {
  all: "All",
  canvases: "Canvases",
  channels: "Channels",
  files: "Files",
  lists: "Lists",
  messages: "Messages",
  people: "People",
};

const STEPS = [
  { id: "search.previousScope", key: "ArrowUp", label: "Previous search tab", step: -1 },
  { id: "search.nextScope", key: "ArrowDown", label: "Next search tab", step: 1 },
] as const;

export default function ScopeBar(props: {
  session: SearchSession;
  target: (element: Element) => boolean;
}) {
  for (const { id, key, label, step } of STEPS) {
    useShortcut({
      allowInInputs: true,
      combo: { key, mod: true },
      group: "Lists",
      handler: () => props.session.cycleScope(step),
      id,
      label,
      scope: "lists",
      target: (element) => props.target(element),
    });
  }
  return (
    <SegmentedControl class="search-scopes flex-shrink-0">
      <For each={SCOPES}>
        {(scope) => (
          <button
            class={["segmented-control-btn", { active: props.session.typed().scope === scope }]}
            onClick={() => props.session.update({ scope })}
            type="button"
          >
            {LABELS[scope]}
          </button>
        )}
      </For>
    </SegmentedControl>
  );
}
