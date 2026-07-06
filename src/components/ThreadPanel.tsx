import { Show, createMemo } from 'solid-js';
import { activeThread, closeThread, threadMessages, channelById } from '../store';
import MessageRows from './MessageRows';
import Composer from './Composer';
import './ThreadPanel.css';

export default function ThreadPanel() {
  const thread = activeThread;

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
        <div class="thread-panel">
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
