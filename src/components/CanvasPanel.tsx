import { Show, createResource, createSignal } from 'solid-js';
import {
  openCanvasChannelId,
  closeChannelCanvas,
  canvasByChannel,
  channelById,
  loadCanvasContent,
  saveChannelCanvas,
} from '../store';
import { useEscapeClose } from '../useEscapeClose';
import './CanvasPanel.css';

export default function CanvasPanel() {
  const channelId = openCanvasChannelId;
  useEscapeClose(closeChannelCanvas);

  const fileId = () => {
    const id = channelId();
    return id ? canvasByChannel[id]?.fileId : undefined;
  };

  const [content, { mutate }] = createResource(fileId, loadCanvasContent);
  const [saving, setSaving] = createSignal(false);
  const [draft, setDraft] = createSignal<string | null>(null);

  const text = () => draft() ?? content() ?? '';

  const save = async () => {
    const id = fileId();
    if (!id) return;
    setSaving(true);
    await saveChannelCanvas(id, text());
    mutate(text());
    setDraft(null);
    setSaving(false);
  };

  return (
    <Show when={channelId()}>
      {(id) => (
        <div class="canvas-panel-overlay" onClick={(e) => e.target === e.currentTarget && closeChannelCanvas()}>
          <div class="canvas-panel-card">
            <div class="canvas-panel-header">
              <div class="canvas-panel-title">Canvas · #{channelById(id())?.name ?? ''}</div>
              <button class="canvas-panel-close" onClick={closeChannelCanvas} title="Close">
                ✕
              </button>
            </div>
            <Show when={!content.loading} fallback={<div class="canvas-panel-loading">Loading canvas…</div>}>
              <textarea
                class="canvas-panel-editor"
                value={text()}
                onInput={(e) => setDraft(e.currentTarget.value)}
                placeholder="Write something for this channel…"
              />
              <div class="canvas-panel-footer">
                <div class="canvas-panel-note">
                  Best-effort preview — formatting may not perfectly match Slack's canvas editor.
                </div>
                <button class="canvas-panel-save" onClick={save} disabled={saving() || draft() === null}>
                  {saving() ? 'Saving…' : 'Save'}
                </button>
              </div>
            </Show>
          </div>
        </div>
      )}
    </Show>
  );
}
