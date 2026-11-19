import type { CanvasVersion } from "@slock/types";
import { Button } from "@slock/ui";
import { Show } from "solid-js";
import { versionAuthor, versionTime } from "../lib/canvasVersions";
import "./CanvasHistory.css";

export default function CanvasVersionBanner(props: {
  canRestore: boolean;
  onExit: () => void;
  onRestore: () => void;
  restoring: boolean;
  version: CanvasVersion;
}) {
  return (
    <div class="canvas-version-banner flex-between" role="status">
      <span>
        Version from {versionTime(props.version)} by {versionAuthor(props.version)}
      </span>
      <div class="flex-align-center canvas-version-actions">
        <Show when={props.canRestore}>
          <Button disabled={props.restoring} onClick={props.onRestore} size="sm">
            Restore
          </Button>
        </Show>
        <Button onClick={props.onExit} size="sm">
          Back to latest
        </Button>
      </div>
    </div>
  );
}
