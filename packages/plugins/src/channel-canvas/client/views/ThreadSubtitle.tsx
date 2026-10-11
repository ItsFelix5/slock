import { service } from "@slock/core/solid";

const canvasStore = service("canvas");

export default function ThreadSubtitle(props: { fileId: string }) {
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
