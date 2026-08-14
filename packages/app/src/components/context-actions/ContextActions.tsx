import {
  listNavigationIndex,
  Modal,
  ModalHeader,
  shortcutsByScope,
  useEscapeClose,
  useShortcut,
} from "@slock/ui";
import { createSignal, For, Show } from "solid-js";
import "./ContextActions.css";

type Action = { keys: string; label: string };

const COMPOSER_ACTIONS: Action[] = [
  { keys: "Enter", label: "Send message" },
  { keys: "Shift Enter", label: "Insert a new line" },
  { keys: "Ctrl/⌘ B", label: "Bold" },
  { keys: "Ctrl/⌘ I", label: "Italic" },
  { keys: "Ctrl/⌘ Shift X", label: "Strikethrough" },
  { keys: "Ctrl/⌘ Shift C", label: "Inline code" },
];

const ESCAPE_ACTION: Action = { keys: "Escape", label: "Close the focused pane or dialog" };
const SPLIT_ACTION: Action = {
  keys: "Ctrl/⌘ Click",
  label: "Open a channel, link, or reply in a new split pane",
};

function ActionList(props: { actions: Action[] }) {
  return (
    <div class="context-actions-list">
      <For each={props.actions}>
        {(action) => (
          <div class="context-actions-row flex-between" tabIndex={0}>
            <span>{action.label}</span>
            <kbd>{action.keys}</kbd>
          </div>
        )}
      </For>
    </div>
  );
}

function onContentKeyDown(event: KeyboardEvent & { currentTarget: HTMLDivElement }) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const rows = [...event.currentTarget.querySelectorAll<HTMLElement>(".context-actions-row")];
  const current = rows.indexOf(document.activeElement as HTMLElement);
  const next = listNavigationIndex(event.key, current < 0 ? null : current, rows.length);
  if (next === undefined) return;
  event.preventDefault();
  rows[next]?.focus();
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
  const generalActions = () => [
    ...(shortcutsByScope().get("general") ?? []),
    SPLIT_ACTION,
    ESCAPE_ACTION,
  ];
  const messageActions = () => shortcutsByScope().get("messages") ?? [];

  return (
    <Show when={open()}>
      <Modal
        ariaLabel="Context actions"
        class="context-actions-card"
        onClose={() => setOpen(false)}
      >
        <ModalHeader onClose={() => setOpen(false)} title="Context actions" />

        <div class="context-actions-content" onKeyDown={onContentKeyDown}>
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
      </Modal>
    </Show>
  );
}
