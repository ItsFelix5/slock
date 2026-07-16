import { Icon, Overlay, Tooltip } from "@slock/ui";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import "./ContextActions.css";

type Action = { keys: string; label: string };

const GENERAL_ACTIONS: Action[] = [
  { keys: "Ctrl/⌘ K", label: "Jump to a channel or person" },
  { keys: "Ctrl/⌘ /", label: "Show context actions" },
  { keys: "Escape", label: "Close the current panel or dialog" },
];

const COMPOSER_ACTIONS: Action[] = [
  { keys: "Enter", label: "Send message" },
  { keys: "Shift Enter", label: "Insert a new line" },
  { keys: "Ctrl/⌘ B", label: "Bold" },
  { keys: "Ctrl/⌘ I", label: "Italic" },
  { keys: "Ctrl/⌘ Shift X", label: "Strikethrough" },
  { keys: "Ctrl/⌘ Shift C", label: "Inline code" },
];

function ActionList(props: { actions: Action[] }) {
  return (
    <div class="context-actions-list">
      <For each={props.actions}>
        {(action) => (
          <div class="context-actions-row flex-between">
            <span>{action.label}</span>
            <kbd>{action.keys}</kbd>
          </div>
        )}
      </For>
    </div>
  );
}

export default function ContextActions() {
  const [open, setOpen] = createSignal(false);
  const [composerContext, setComposerContext] = createSignal(false);

  onMount(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && !event.altKey && (event.key === "/" || event.code === "Slash")) {
        event.preventDefault();
        if (event.repeat) return;
        const target = event.target instanceof Element ? event.target : document.activeElement;
        setComposerContext(Boolean(target?.closest(".composer")));
        setOpen((value) => !value);
      } else if (event.key === "Escape" && open()) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));
  });

  return (
    <Show when={open()}>
      <Overlay onClose={() => setOpen(false)}>
        <div aria-modal="true" class="context-actions-card modal-card" role="dialog">
          <div class="context-actions-header flex-between">
            <div>
              <h2>Context actions</h2>
              <p>{composerContext() ? "Available while writing a message" : "Available here"}</p>
            </div>
            <Tooltip content="Close">
              <button
                aria-label="Close"
                class="panel-close-btn"
                onClick={() => setOpen(false)}
                type="button"
              >
                <Icon name="close" size={12} />
              </button>
            </Tooltip>
          </div>

          <div class="context-actions-content">
            <Show when={composerContext()}>
              <section>
                <h3>Composer</h3>
                <ActionList actions={COMPOSER_ACTIONS} />
              </section>
            </Show>
            <section>
              <h3>General</h3>
              <ActionList actions={GENERAL_ACTIONS} />
            </section>
          </div>
        </div>
      </Overlay>
    </Show>
  );
}
