import { Icon, Tooltip } from "@slock/ui";
import { createSignal, onCleanup, Show } from "solid-js";

function FileChipThumbnail(props: { file: File }) {
  if (!props.file.type.startsWith("image/")) return null;
  const url = URL.createObjectURL(props.file);
  onCleanup(() => URL.revokeObjectURL(url));
  return <img alt="" class="composer-file-chip-thumb" src={url} />;
}

export default function FileChip(props: {
  file: File;
  disabled: boolean;
  onRemove: () => void;
  onRename: (name: string) => void;
}) {
  const [renaming, setRenaming] = createSignal(false);
  const [draft, setDraft] = createSignal("");
  const isImage = () => props.file.type.startsWith("image/");

  const startRename = () => {
    if (props.disabled) return;
    setDraft(props.file.name);
    setRenaming(true);
  };
  const commit = () => {
    if (!renaming()) return;
    setRenaming(false);
    props.onRename(draft());
  };

  return (
    <span
      class="composer-file-chip flex-align-center"
      classList={{ "composer-file-chip-image": isImage() }}
    >
      <FileChipThumbnail file={props.file} />
      <span class="composer-file-chip-details">
        <Show
          fallback={
            <input
              autofocus
              class="composer-file-chip-rename-input"
              onBlur={commit}
              onInput={(e) => setDraft(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setRenaming(false);
                }
              }}
              ref={(el) => requestAnimationFrame(() => el.select())}
              value={draft()}
            />
          }
          when={!renaming()}
        >
          <button
            class="composer-file-chip-name btn-reset"
            disabled={props.disabled}
            onClick={startRename}
            type="button"
          >
            {props.file.name}
          </button>
        </Show>
      </span>
      <Tooltip content="Remove">
        <button
          class="composer-file-chip-remove btn-reset"
          disabled={props.disabled}
          onClick={props.onRemove}
          type="button"
        >
          <Icon name="close" size={16} />
        </button>
      </Tooltip>
    </span>
  );
}
