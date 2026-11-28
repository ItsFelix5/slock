import { For, onSettled } from "solid-js";
import { TAG_COLORS, type TagColor, tagColorClass } from "../../tag/tagColors";

export type ColorChoice = TagColor | "highlight";

const CHOICES: ColorChoice[] = ["highlight", ...TAG_COLORS];
const DIGITS = "0123456789";

interface FormatBubbleColorsProps {
  onBlur: () => void;
  onCancel: () => void;
  onPick: (choice: ColorChoice) => void;
}

function neighbour(target: EventTarget, forward: boolean) {
  if (!(target instanceof HTMLElement)) return null;
  const { parentElement: row } = target;
  return forward
    ? (target.nextElementSibling ?? row?.firstElementChild)
    : (target.previousElementSibling ?? row?.lastElementChild);
}

export default function FormatBubbleColors(props: FormatBubbleColorsProps) {
  let row: HTMLDivElement | undefined;
  onSettled(() => row?.querySelector("button")?.focus());

  return (
    <div
      class="flex-align-center gap-xs"
      onFocusOut={(event) => {
        const next = event.relatedTarget;
        if (!(next instanceof Node && event.currentTarget.contains(next))) props.onBlur();
      }}
      onKeyDown={(event) => {
        const choice = CHOICES[DIGITS.indexOf(event.key)];
        const arrow = event.key === "ArrowRight" || event.key === "ArrowLeft";
        if (choice) props.onPick(choice);
        else if (event.key === "Escape") props.onCancel();
        else if (arrow) {
          const next = neighbour(event.target, event.key === "ArrowRight");
          if (next instanceof HTMLElement) next.focus();
        } else return;
        event.preventDefault();
        event.stopPropagation();
      }}
      ref={row}
    >
      <For each={CHOICES}>
        {(choice, index) => (
          <button
            class={[
              "btn-reset format-bubble-swatch",
              choice === "highlight"
                ? "format-bubble-highlight"
                : ["bk-tag", tagColorClass(choice)],
            ]}
            onClick={() => props.onPick(choice)}
            type="button"
          >
            {index()}
          </button>
        )}
      </For>
    </div>
  );
}
