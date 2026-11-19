import type { CanvasVersion } from "@slock/types";
import { Avatar, inside, useCancelShortcut, useEscapeClose } from "@slock/ui";
import { For, onMount, Show } from "solid-js";
import {
  groupVersionsByDay,
  versionAuthor,
  versionAuthorUser,
  versionClock,
} from "../lib/canvasVersions";
import "./CanvasHistory.css";

export default function CanvasHistory(props: {
  anchor: () => HTMLElement | undefined;
  error: boolean;
  loading: boolean;
  onClose: () => void;
  onSelect: (version: CanvasVersion | null) => void;
  selected: CanvasVersion | null;
  versions: CanvasVersion[];
}) {
  let panel: HTMLElement | undefined;
  const latestId = () => props.versions[0]?.versionId;
  const isSelected = (version: CanvasVersion) =>
    props.selected
      ? props.selected.versionId === version.versionId
      : version.versionId === latestId();

  useEscapeClose(props.onClose);
  useCancelShortcut(
    () => {
      props.onClose();
      queueMicrotask(() => props.anchor()?.focus());
    },
    { target: inside(() => panel) },
  );
  onMount(() => panel?.querySelector<HTMLElement>("[aria-pressed='true']")?.focus());

  return (
    <aside
      aria-label="Version history"
      class="canvas-history"
      ref={(element) => {
        panel = element;
      }}
    >
      <header class="canvas-history-header">
        <strong>History</strong>
      </header>
      <For each={groupVersionsByDay(props.versions)}>
        {(day) => (
          <section>
            <h3 class="canvas-history-day text-dim">{day.label}</h3>
            <ol class="canvas-history-list">
              <For each={day.versions}>
                {(version) => (
                  <li>
                    <button
                      aria-pressed={isSelected(version)}
                      class="canvas-history-item btn-reset flex-align-center"
                      onClick={() =>
                        props.onSelect(version.versionId === latestId() ? null : version)
                      }
                      type="button"
                    >
                      <Show when={versionAuthorUser(version)}>
                        {(user) => <Avatar size="small" user={user()} />}
                      </Show>
                      <span class="flex-col canvas-history-text">
                        <span class="canvas-history-time">{versionClock(version)}</span>
                        <span class="canvas-history-author text-dim">{versionAuthor(version)}</span>
                      </span>
                    </button>
                  </li>
                )}
              </For>
            </ol>
          </section>
        )}
      </For>
      <Show when={props.loading}>
        <div class="canvas-history-note text-dim" role="status">
          Loading…
        </div>
      </Show>
      <Show when={props.error}>
        <div class="canvas-history-note text-dim" role="alert">
          Couldn't load the history.
        </div>
      </Show>
    </aside>
  );
}
