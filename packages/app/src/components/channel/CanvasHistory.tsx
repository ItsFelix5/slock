import type { CanvasVersion } from "@slock/types";
import { useClickOutside, useEscapeClose } from "@slock/ui";
import { For, Show } from "solid-js";
import { versionAuthor, versionTime } from "../../lib/canvas/canvasVersionLabel";
import "./CanvasHistory.css";

export default function CanvasHistory(props: {
  anchor: () => Element | undefined;
  error: boolean;
  loading: boolean;
  onClose: () => void;
  onSelect: (version: CanvasVersion | null) => void;
  selected: CanvasVersion | null;
  versions: CanvasVersion[];
}) {
  let panel: HTMLElement | undefined;
  useClickOutside([() => panel, props.anchor], props.onClose);
  useEscapeClose(props.onClose);

  return (
    <aside
      aria-label="Version history"
      class="canvas-history surface-popover"
      ref={(element) => {
        panel = element;
      }}
    >
      <header class="canvas-history-header">
        <strong>Version history</strong>
      </header>
      <ol class="canvas-history-list">
        <li>
          <button
            aria-pressed={!props.selected}
            class="canvas-history-item btn-reset flex-col"
            onClick={() => props.onSelect(null)}
            type="button"
          >
            <span class="canvas-history-time">Latest</span>
          </button>
        </li>
        <For each={props.versions}>
          {(version) => (
            <li>
              <button
                aria-pressed={props.selected?.versionId === version.versionId}
                class="canvas-history-item btn-reset flex-col"
                onClick={() => props.onSelect(version)}
                type="button"
              >
                <span class="canvas-history-time">{versionTime(version)}</span>
                <span class="canvas-history-author text-dim">{versionAuthor(version)}</span>
              </button>
            </li>
          )}
        </For>
      </ol>
      <Show when={props.loading}>
        <div class="canvas-history-note text-dim">Loading…</div>
      </Show>
      <Show when={props.error}>
        <div class="canvas-history-note text-dim" role="alert">
          Couldn't load the history.
        </div>
      </Show>
    </aside>
  );
}
