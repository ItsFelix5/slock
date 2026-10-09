import type { CanvasVersion } from "@slock/types";
import { Button, Switch } from "@slock/ui";
import { createSignal, For, Show } from "solid-js";
import { store } from "../../lib/store";
import "./CanvasHistory.css";

const DAY_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const TIME_FORMAT = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });

export function versionLabel(version: CanvasVersion): string {
  const date = new Date(version.createdMs);
  return `${DAY_FORMAT.format(date)} at ${TIME_FORMAT.format(date)}`;
}

export function versionAuthor(version: CanvasVersion): string {
  return store.users.userById(version.authorId)?.name ?? version.authorId;
}

export default function CanvasHistory(props: {
  error: boolean;
  loading: boolean;
  onClose: () => void;
  onRestore: (version: CanvasVersion) => Promise<void>;
  onSelect: (version: CanvasVersion | null) => void;
  onToggleChanges: (value: boolean) => void;
  selected: CanvasVersion | null;
  showChanges: boolean;
  versions: CanvasVersion[];
}) {
  const [restoring, setRestoring] = createSignal(false);

  async function restore(version: CanvasVersion) {
    setRestoring(true);
    try {
      await props.onRestore(version);
    } finally {
      setRestoring(false);
    }
  }

  return (
    <aside aria-label="Version history" class="canvas-history surface-popover">
      <header class="canvas-history-header flex-between">
        <strong>Version history</strong>
        <Button onClick={props.onClose} size="sm">
          Done
        </Button>
      </header>
      <Show when={props.selected}>
        {(version) => (
          <div class="canvas-history-actions flex-col">
            <label class="canvas-history-toggle flex-between">
              <span>Show changes</span>
              <Switch checked={props.showChanges} onChange={props.onToggleChanges} />
            </label>
            <div class="canvas-history-buttons flex-align-center">
              <Button disabled={restoring()} onClick={() => void restore(version())} size="sm">
                Restore this version
              </Button>
              <Button onClick={() => props.onSelect(null)} size="sm">
                Back to current
              </Button>
            </div>
          </div>
        )}
      </Show>
      <Show when={props.loading}>
        <div class="canvas-history-note text-dim">Loading…</div>
      </Show>
      <Show when={props.error}>
        <div class="canvas-history-note text-dim" role="alert">
          Couldn't load the history.
        </div>
      </Show>
      <Show when={!(props.loading || props.error) && props.versions.length === 0}>
        <div class="canvas-history-note text-dim">No earlier versions yet.</div>
      </Show>
      <ol class="canvas-history-list">
        <For each={props.versions}>
          {(version) => (
            <li>
              <button
                aria-pressed={props.selected?.versionId === version.versionId}
                class="canvas-history-item btn-reset flex-col"
                onClick={() => props.onSelect(version)}
                type="button"
              >
                <span class="canvas-history-time">{versionLabel(version)}</span>
                <span class="canvas-history-author text-dim">{versionAuthor(version)}</span>
              </button>
            </li>
          )}
        </For>
      </ol>
    </aside>
  );
}
