import type { FileInputProps } from "@slock/blockkit";
import { Icon, IconButton } from "@slock/ui";
import { createSignal, For, Show } from "solid-js";
import { uploadFilesForEdit } from "../../slack/client/api";
import "./FileInput.css";

const DEFAULT_MAX_FILES = 10;

type Uploaded = { id: string; name: string };

export default function FileInput(props: FileInputProps) {
  const [files, setFiles] = createSignal<Uploaded[]>([]);
  const [uploading, setUploading] = createSignal(false);
  const [failed, setFailed] = createSignal(false);
  let input: HTMLInputElement | undefined;

  const limit = () => props.maxFiles ?? DEFAULT_MAX_FILES;
  const accepted = (file: File) =>
    !props.filetypes?.length ||
    props.filetypes.includes(file.name.split(".").pop()?.toLowerCase() ?? "");

  const commit = (next: Uploaded[]) => {
    setFiles(next);
    props.onChange(next.map(({ id }) => ({ id })));
  };

  const upload = async (picked: FileList | null) => {
    const chosen = [...(picked ?? [])].filter(accepted).slice(0, limit() - files().length);
    if (!chosen.length) return;
    setUploading(true);
    setFailed(false);
    try {
      const done = await uploadFilesForEdit(chosen.map((file) => ({ file })));
      commit([...files(), ...done.map((file) => ({ id: file.id, name: file.name }))]);
    } catch {
      setFailed(true);
    } finally {
      setUploading(false);
      if (input) input.value = "";
    }
  };

  return (
    <div class="file-input flex-col">
      <input
        accept={props.filetypes?.map((type) => `.${type}`).join(",")}
        hidden
        multiple={limit() > 1}
        onChange={(event) => upload(event.currentTarget.files)}
        ref={input}
        type="file"
      />
      <For each={files()}>
        {(file) => (
          <div class="file-input-file flex-align-center">
            <Icon class="file-input-icon" name="file" size={16} />
            <span class="grow truncate">{file.name}</span>
            <IconButton
              icon="close"
              label={`Remove ${file.name}`}
              onClick={() => commit(files().filter((other) => other.id !== file.id))}
            />
          </div>
        )}
      </For>
      <Show when={files().length < limit()}>
        <button
          class="file-input-pick btn-reset flex-center"
          disabled={props.disabled || uploading()}
          onClick={() => input?.click()}
          type="button"
        >
          <Icon name="attachment" size={16} />
          {uploading() ? "Uploading" : "Choose files"}
        </button>
      </Show>
      <Show when={failed()}>
        <span class="inline-feedback-error">Upload failed</span>
      </Show>
    </div>
  );
}
