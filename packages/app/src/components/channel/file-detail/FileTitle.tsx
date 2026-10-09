import type { SlackFile } from "@slock/types";
import { IconButton } from "@slock/ui";
import { createSignal, Show } from "solid-js";
import { renameFile } from "../../../lib/api";
import { flashCaughtError } from "../../../lib/feedback";

export default function FileTitle(props: {
  editable: boolean;
  file: SlackFile;
  onRenamed: () => void;
}) {
  const [saved, setSaved] = createSignal<string | null>(null);
  const current = () => saved() ?? (props.file.title || props.file.name);
  const [draft, setDraft] = createSignal<string | null>(null);

  async function commit() {
    const title = draft()?.trim();
    setDraft(null);
    if (!title || title === current()) return;
    try {
      await renameFile(props.file.id, title);
      setSaved(title);
      props.onRenamed();
    } catch (error) {
      flashCaughtError(props.file.id, error, "Couldn't rename the file");
    }
  }

  return (
    <Show
      fallback={
        <input
          aria-label="File name"
          class="file-detail-title-input text-field"
          onBlur={() => void commit()}
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
      <h2 class="file-detail-title truncate">{current()}</h2>
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
