import { Button, Icon, type Pane, PanelHeader } from "@slock/ui";
import { createResource, Show } from "solid-js";
import { closeTile } from "../../lib/paneActions";
import { store } from "../../lib/store";
import type { CanvasPaneContent } from "../../lib/store/slices/types";
import "./CanvasPanel.css";

// Read-only viewer — no in-app editing yet, just the channel's canvas content.
export default function CanvasPanel(props: { pane: Pane<CanvasPaneContent> }) {
  const fileId = () => props.pane.content.fileId;

  const [content, { refetch }] = createResource(fileId, store.canvas.loadCanvasContent);
  const [fileUrl] = createResource(fileId, store.canvas.loadCanvasFileUrl);

  return (
    <div class="canvas-panel-card flex-col surface-card" data-pane={props.pane.id}>
      <PanelHeader onClose={() => closeTile(props.pane.id)}>
        <div class="canvas-panel-header-info flex-align-center">
          <div class="canvas-panel-title truncate">{props.pane.content.title}</div>
          <Show when={fileUrl()}>
            {(url) => (
              <a
                aria-label="Open in new tab"
                class="canvas-panel-open-link"
                href={url()}
                rel="noopener noreferrer"
                target="_blank"
              >
                <Icon name="open-in-tab" size={15} />
              </a>
            )}
          </Show>
        </div>
      </PanelHeader>
      <div class="canvas-panel-body">
        <Show when={content.loading}>
          <div class="canvas-panel-loading flex-center text-dim text-sm">Loading…</div>
        </Show>
        <Show when={!content.loading && content() === null}>
          <div class="canvas-panel-load-error flex-center flex-col" role="alert">
            <span>Something went wrong.</span>
            <Button onClick={() => refetch()} size="sm">
              Try again
            </Button>
          </div>
        </Show>
        <Show when={!content.loading && content() != null}>
          <div class="canvas-panel-content input-reset" innerHTML={content() ?? ""} />
        </Show>
      </div>
    </div>
  );
}
