import { Show, createMemo, createSignal } from 'solid-js';
import { activeThread, closeThread, threadMessages, channelById } from '../../lib/store';
import MessageRows from './MessageRows';
import Composer from '../composer/Composer';
import ResizeHandle from '../layout/ResizeHandle';
import './ThreadPanel.css';

const DEFAULT_WIDTH = 380;
const MIN_WIDTH = 280;
const MAX_WIDTH = 640;

export default function ThreadPanel() {
  const thread = activeThread;
  const [width, setWidth] = createSignal(DEFAULT_WIDTH);

  const messages = createMemo(() => {
    const t = thread();
    if (!t) return [];
    return threadMessages[t.ts] ?? [];
  });

  const channelName = createMemo(() => {
    const t = thread();
    if (!t) return '';
    return channelById(t.channelId)?.name ?? '';
  });

  return (
    <Show when={thread()}>
      {(t) => (
        <div class="thread-panel" style={{ width: `${width()}px` }}>
          <ResizeHandle width={width} setWidth={setWidth} min={MIN_WIDTH} max={MAX_WIDTH} direction={-1} side="left" />
          <div class="thread-panel-header">
            <div>
              <div class="thread-panel-title">Thread</div>
              <div class="thread-panel-subtitle">#{channelName()}</div>
            </div>
            <button class="thread-panel-close" onClick={closeThread}>
              ✕
            </button>
          </div>
          <div class="thread-panel-messages">
            <MessageRows messages={messages()} channelId={t().channelId} location={{ store: 'thread', key: t().ts }} />
          </div>
          <Composer channelId={t().channelId} threadTs={t().ts} placeholder="Reply…" />
        </div>
      )}
    </Show>
  );
}
