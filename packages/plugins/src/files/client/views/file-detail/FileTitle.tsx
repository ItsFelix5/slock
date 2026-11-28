import { EmojiText } from "@slock/blockkit";
import { mentionText } from "@slock/plugins/users/client/api";
import type { SlackFile } from "@slock/types";
import { IconButton } from "@slock/ui";
import { createSignal, Show } from "solid-js";
import { fileRename } from "../../fileMutations";

export default function FileTitle(props: { editable: boolean; file: SlackFile }) {
  const current = () => props.file.title || props.file.name;
  const [draft, setDraft] = createSignal<string | null>(null);

  function commit() {
    const title = draft()?.trim();
    setDraft(null);
    if (title && title !== current()) void fileRename.run({ fileId: props.file.id, title });
  }

  return (
    <Show
      fallback={
        <input
          aria-label="File name"
          class="file-detail-title-input text-field"
          onBlur={commit}
          onInput={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key !== "Escape") return;
            event.stopPropagation();
            setDraft(null);
          }}
          ref={(element) =>
            queueMicrotask(() => {
              element.focus();
              element.select();
            })
          }
          value={draft() ?? ""}
        />
      }
      when={draft() === null}
    >
      <h2 class="file-detail-title truncate">
        <EmojiText text={mentionText(current())} />
      </h2>
      <Show when={props.editable}>
        <IconButton
          icon="edit"
          iconSize={14}
          label="Rename"
          onClick={() => setDraft(current())}
          size="sm"
        />
      </Show>
    </Show>
  );
}
