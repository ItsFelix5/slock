import type { CanvasVersion, FileId } from "@slock/types";
import { Button } from "@slock/ui";
import { Show } from "solid-js";
import type { createCanvasHistory } from "../lib/canvasHistory";
import type { OutlineSource } from "../lib/canvasOutline";
import CanvasEditor from "./CanvasEditor";
import CanvasVersionBanner from "./CanvasVersionBanner";

export default function CanvasVersionView(props: {
  canRestore: boolean;
  fileId: FileId;
  history: ReturnType<typeof createCanvasHistory>;
  onOutline: (source: OutlineSource | null) => void;
  version: CanvasVersion;
}) {
  return (
    <div class="canvas-version-view">
      <CanvasVersionBanner
        canRestore={props.canRestore}
        onExit={() => props.history.setSelected(null)}
        onRestore={() => void props.history.restore(props.version)}
        restoring={props.history.restoring()}
        version={props.version}
      />
      <Show
        fallback={
          <Show
            fallback={<div class="canvas-panel-loading flex-center text-dim text-sm">Loading…</div>}
            when={props.history.failed()}
          >
            <div class="canvas-panel-load-error flex-center flex-col" role="alert">
              <span>Couldn't load this version.</span>
              <Button onClick={props.history.retry} size="sm">
                Try again
              </Button>
            </div>
          </Show>
        }
        keyed
        when={props.history.viewing().data}
      >
        {(view) => (
          <CanvasEditor
            access="view"
            diff={view.diff}
            doc={view.doc}
            fileId={props.fileId}
            onOutline={props.onOutline}
          />
        )}
      </Show>
    </div>
  );
}
