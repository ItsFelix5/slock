import type { CanvasVersion } from "@slock/types";
import { Button, IconButton } from "@slock/ui";
import { Show } from "solid-js";
import { versionAuthor, versionTime } from "../lib/canvasVersionLabel";
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
        Viewing {versionTime(props.version)} by {versionAuthor(props.version)}
      </span>
      <div class="flex-align-center canvas-version-actions">
        <Show when={props.canRestore}>
          <IconButton
            disabled={props.restoring}
            icon="undo"
            label="Restore this version"
            onClick={props.onRestore}
            size="sm"
          />
        </Show>
        <Button onClick={props.onExit} size="sm">
          Back to latest
        </Button>
      </div>
    </div>
  );
}
