import { Icon, Overlay, shortcutsByScope, Tooltip, useEscapeClose, useShortcut } from "@slock/ui";
import { createSignal, For, Show } from "solid-js";
import "./ContextActions.css";

type Action = { keys: string; label: string };

// The composer's own key handler (composerKeyboard.ts) owns these directly —
// they're not global shortcuts, so they don't go through the shared registry.
const COMPOSER_ACTIONS: Action[] = [
  { keys: "Enter", label: "Send message" },
  { keys: "Shift Enter", label: "Insert a new line" },
  { keys: "Ctrl/⌘ B", label: "Bold" },
  { keys: "Ctrl/⌘ I", label: "Italic" },
  { keys: "Ctrl/⌘ Shift X", label: "Strikethrough" },
  { keys: "Ctrl/⌘ Shift C", label: "Inline code" },
];

// useEscapeClose is its own layered stack, not part of the shortcut registry,
// so this one entry is still listed by hand.
const ESCAPE_ACTION: Action = { keys: "Escape", label: "Close the current panel or dialog" };

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

  useShortcut({
    allowInInputs: true,
    allowRepeat: false,
    handler: (event) => {
      const target = event.target instanceof Element ? event.target : document.activeElement;
      setComposerContext(Boolean(target?.closest(".composer")));
      setOpen((value) => !value);
    },
    keys: "Ctrl/⌘ /",
    label: "Show context actions",
    match: (e) => (e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "/" || e.code === "Slash"),
    scope: "general",
  });
  useEscapeClose(() => setOpen(false), open);
  const generalActions = () => [...(shortcutsByScope().get("general") ?? []), ESCAPE_ACTION];
  const messageActions = () => shortcutsByScope().get("messages") ?? [];

  return (
    <Show when={open()}>
      <Overlay ariaLabel="Context actions" onClose={() => setOpen(false)}>
        <div class="context-actions-card modal-card">
          <div class="context-actions-header flex-between">
            <div>
              <h2>Context actions</h2>
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
            <Show when={messageActions().length > 0}>
              <section>
                <h3>Messages</h3>
                <ActionList actions={messageActions()} />
              </section>
            </Show>
            <section>
              <h3>General</h3>
              <ActionList actions={generalActions()} />
            </section>
          </div>
        </div>
      </Overlay>
    </Show>
  );
}
