import { IconButton, useEditShortcuts } from "@slock/ui";
import { createSignal, onCleanup, Show } from "solid-js";

function FileChipThumbnail(props: { file: File; thumbSrc?: string }) {
  if (props.thumbSrc) return <img alt="" class="composer-file-chip-thumb" src={props.thumbSrc} />;
  if (!props.file.type.startsWith("image/")) return null;
  const url = URL.createObjectURL(props.file);
  onCleanup(() => URL.revokeObjectURL(url));
  return <img alt="" class="composer-file-chip-thumb" src={url} />;
}

export default function FileChip(props: {
  file: File;
  disabled: boolean;
  onRemove: () => void;
  onRename?: (name: string) => void;
  thumbSrc?: string;
}) {
  const [renaming, setRenaming] = createSignal(false);
  const [draft, setDraft] = createSignal("");
  let chipRef: HTMLSpanElement | undefined;
  const isImage = () => !!props.thumbSrc || props.file.type.startsWith("image/");

  const startRename = () => {
    if (props.disabled || !props.onRename) return;
    setDraft(props.file.name);
    setRenaming(true);
  };
  const commit = () => {
    if (!renaming()) return;
    setRenaming(false);
    props.onRename?.(draft());
  };

  useEditShortcuts({
    cancel: () => setRenaming(false),
    commit,
    enabled: renaming,
    root: () => chipRef,
  });

  return (
    <span
      class="composer-file-chip flex-align-center"
      classList={{ "composer-file-chip-image": isImage() }}
      ref={chipRef}
    >
      <FileChipThumbnail file={props.file} thumbSrc={props.thumbSrc} />
      <span class="composer-file-chip-details">
        <Show
          fallback={
            <input
              autofocus
              class="composer-file-chip-rename-input"
              onBlur={commit}
              onInput={(e) => setDraft(e.currentTarget.value)}
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
      <IconButton
        class="composer-file-chip-remove icon-shift"
        disabled={props.disabled}
        icon="close"
        label="Remove"
        onClick={props.onRemove}
        size="sm"
      />
    </span>
  );
}
