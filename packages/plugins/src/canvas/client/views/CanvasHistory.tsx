import { service } from "@slock/core/solid";
import type { CanvasVersion } from "@slock/types";
import { Avatar, ariaBoolean } from "@slock/ui";
import { For, Show } from "solid-js";
import {
  groupVersionsByDay,
  versionAuthor,
  versionAuthorUser,
  versionClock,
} from "../lib/canvasVersions";
import CanvasSidePanel from "./CanvasSidePanel";
import "./CanvasHistory.css";

const env = service("env");

export default function CanvasHistory(props: {
  anchor: () => HTMLElement | undefined;
  error: boolean;
  loading: boolean;
  onClose: () => void;
  onSelect: (version: CanvasVersion | null) => void;
  selected: CanvasVersion | null;
  versions: CanvasVersion[];
}) {
  const latestId = () => props.versions[0]?.versionId;
  const isSelected = (version: CanvasVersion) =>
    props.selected
      ? props.selected.versionId === version.versionId
      : version.versionId === latestId();

  return (
    <CanvasSidePanel
      anchor={props.anchor}
      label="Version history"
      onClose={props.onClose}
      title="History"
    >
      <For each={groupVersionsByDay(props.versions, env.now())} keyed={(day) => day.label}>
        {(day) => (
          <section>
            <h3 class="canvas-side-heading text-dim">{day().label}</h3>
            <ol class="canvas-side-list">
              <For each={day().versions} keyed={(version) => version.versionId}>
                {(version) => (
                  <li>
                    <button
                      aria-pressed={ariaBoolean(isSelected(version()))}
                      class="canvas-history-item btn-reset flex-align-center"
                      data-nav-row
                      onClick={() =>
                        props.onSelect(version().versionId === latestId() ? null : version())
                      }
                      type="button"
                    >
                      <Show when={versionAuthorUser(version())}>
                        {(user) => <Avatar size="small" user={user()} />}
                      </Show>
                      <span class="flex-col canvas-history-text">
                        <span class="canvas-history-time">{versionClock(version())}</span>
                        <span class="canvas-history-author text-dim">
                          {versionAuthor(version())}
                          {version().commentOnly ? " · Comment added" : ""}
                        </span>
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
        <div class="canvas-side-note text-dim" role="status">
          Loading…
        </div>
      </Show>
      <Show when={props.error}>
        <div class="canvas-side-note text-dim" role="alert">
          Couldn't load the history.
        </div>
      </Show>
    </CanvasSidePanel>
  );
}
