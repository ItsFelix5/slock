import { IconButton } from "@slock/ui";
import { createSignal, onCleanup, Show } from "solid-js";
import "./CanvasSelectionActions.css";

export default function CanvasSelectionActions(props: {
  container: HTMLElement;
  onComment: () => void;
  onReact: () => void;
}) {
  const [top, setTop] = createSignal<number>();

  function update() {
    const selection = window.getSelection();
    const range = selection && !selection.isCollapsed ? selection.getRangeAt(0) : undefined;
    const node = range?.commonAncestorContainer;
    const element = node instanceof Element ? node : node?.parentElement;
    const inEditor = element?.closest(".ql-editor") && props.container.contains(element);
    const first = inEditor ? range?.getClientRects()[0] : undefined;
    setTop(first ? first.top - props.container.getBoundingClientRect().top : undefined);
  }

  document.addEventListener("selectionchange", update);
  onCleanup(() => document.removeEventListener("selectionchange", update));

  return (
    <Show when={top()}>
      {(offset) => (
        <div
          class="canvas-selection-actions flex-align-center"
          onMouseDown={(event) => event.preventDefault()}
          style={{ top: `${offset()}px` }}
        >
          <IconButton icon="add-comment" label="Comment" onClick={props.onComment} size="sm" />
          <IconButton icon="add-reaction" label="React" onClick={props.onReact} size="sm" />
        </div>
      )}
    </Show>
  );
}
