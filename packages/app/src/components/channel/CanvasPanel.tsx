import { InlineFeedback, Overlay, PanelHeader, useEscapeClose } from "@slock/ui";
import { createResource, createSignal, Show } from "solid-js";
import { store, actionFeedback, channelDisplayName } from "../../lib/store";
import "./CanvasPanel.css";

export default function CanvasPanel() {
  const channelId = store.canvas.openCanvasChannelId;
  useEscapeClose(store.canvas.closeChannelCanvas);

  const fileId = () => {
    const id = channelId();
    return id ? store.canvas.canvasByChannel[id]?.fileId : undefined;
  };

  const [content, { mutate }] = createResource(fileId, store.canvas.loadCanvasContent);
  const [saving, setSaving] = createSignal(false);
  const [draft, setDraft] = createSignal<string | null>(null);

  const text = () => draft() ?? content() ?? "";

  const save = async () => {
    const id = fileId();
    if (!id) return;
    setSaving(true);
    await store.canvas.saveChannelCanvas(id, text());
    mutate(text());
    setDraft(null);
    setSaving(false);
  };

  return (
    <Show when={channelId()}>
      {(id) => (
        <Overlay onClose={store.canvas.closeChannelCanvas}>
          <div class="canvas-panel-card flex-col">
            <PanelHeader onClose={store.canvas.closeChannelCanvas}>
              <div class="canvas-panel-title">
                Canvas · #{channelDisplayName(store.channels.channelById(id()), id())}
              </div>
            </PanelHeader>
            <Show
              fallback={
                <div class="canvas-panel-loading flex-center text-dim text-sm">Loading canvas…</div>
              }
              when={!content.loading}
            >
              <textarea
                class="canvas-panel-editor"
                onInput={(e) => setDraft(e.currentTarget.value)}
                placeholder="Write something for this channel…"
                value={text()}
              />
              <div class="canvas-panel-footer flex-between">
                <InlineFeedback feedback={actionFeedback.get(fileId() ?? "")} />
                <button
                  class="canvas-panel-save btn-reset"
                  disabled={saving() || draft() === null}
                  onClick={save}
                  type="button"
                >
                  {saving() ? "Saving…" : "Save"}
                </button>
              </div>
            </Show>
          </div>
        </Overlay>
      )}
    </Show>
  );
}
