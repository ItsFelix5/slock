import { service } from "@slock/core/solid";
import { Button } from "@slock/ui";
import { createSignal, Show } from "solid-js";

export function UploadPlugin() {
  const plugins = service("plugins");
  const [error, setError] = createSignal<string>();
  let fileInput: HTMLInputElement | undefined;

  async function install(file: File | undefined) {
    if (!file) return;
    setError(undefined);
    try {
      await plugins.install(file);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <div class="settings-row">
      <div class="settings-row-label">Add a plugin</div>
      <div class="settings-row-meta text-dim">Plugins run with full access to your account.</div>
      <input
        accept=".js,text/javascript"
        hidden
        onChange={(event) => void install(event.currentTarget.files?.[0])}
        ref={fileInput}
        type="file"
      />
      <Button onClick={() => fileInput?.click()} size="sm">
        Choose file
      </Button>
      <Show when={error()}>
        {(message) => <div class="settings-account-error">{message()}</div>}
      </Show>
    </div>
  );
}
