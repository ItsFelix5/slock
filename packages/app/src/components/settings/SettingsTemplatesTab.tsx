import { blockPreviewText } from "@slock/types";
import { useEditShortcuts } from "@slock/ui";
import { createSignal, For, Show } from "solid-js";
import { store } from "../../lib/store";
import "./Settings.css";

function TemplateRow(props: { id: string; name: string; preview: string; fileCount: number }) {
  const [editing, setEditing] = createSignal(false);
  const [name, setName] = createSignal(props.name);
  let rowRef: HTMLDivElement | undefined;

  const commitRename = () => {
    setEditing(false);
    if (name().trim() && name().trim() !== props.name) {
      store.composerTemplates.renameTemplate(props.id, name());
    } else {
      setName(props.name);
    }
  };

  useEditShortcuts({
    cancel: () => {
      setName(props.name);
      setEditing(false);
    },
    commit: commitRename,
    enabled: editing,
    root: () => rowRef,
  });

  return (
    <div class="settings-list-row flex-between" ref={rowRef}>
      <span class="settings-list-row-name flex-col">
        <Show
          fallback={
            <button class="btn-reset" onClick={() => setEditing(true)} type="button">
              {props.name}
            </button>
          }
          when={editing()}
        >
          <input
            class="text-field"
            onBlur={commitRename}
            onInput={(e) => setName(e.currentTarget.value)}
            type="text"
            value={name()}
          />
        </Show>
        <span class="text-dim text-sm truncate">
          {props.preview}
          {props.fileCount > 0 ? ` · ${props.fileCount} file${props.fileCount > 1 ? "s" : ""}` : ""}
        </span>
      </span>
      <button
        class="settings-list-row-action btn-reset text-muted"
        onClick={() => store.composerTemplates.removeTemplate(props.id)}
        type="button"
      >
        Remove
      </button>
    </div>
  );
}

export default function SettingsTemplatesTab() {
  return (
    <>
      <h2>Templates</h2>
      <div class="settings-section">
        <div class="settings-row-label">Reaction templates</div>
        <div class="settings-list flex-col">
          <For each={store.composerTemplates.templates()}>
            {(t) => (
              <TemplateRow
                fileCount={t.files?.length ?? 0}
                id={t.id}
                name={t.name}
                preview={blockPreviewText(t.blocks)}
              />
            )}
          </For>
        </div>
      </div>
    </>
  );
}
