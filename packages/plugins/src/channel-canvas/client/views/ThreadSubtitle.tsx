import { service } from "@slock/core/solid";
import type { FileId } from "@slock/types";

const canvasStore = service("canvas");

export default function ThreadSubtitle(props: { fileId: FileId }) {
  const title = () => canvasStore.canvasTitle(props.fileId) ?? "Canvas";

  return (
    <button
      aria-label={`Open the canvas ${title()}`}
      class="thread-panel-subtitle btn-reset flex-align-center truncate"
      onClick={() => canvasStore.openCanvasPane(props.fileId, title())}
      type="button"
    >
      {title()}
    </button>
  );
}
