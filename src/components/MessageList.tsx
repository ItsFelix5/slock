import { Show, createMemo } from 'solid-js';
import { activeView, messagesByChannel, dmById, channelById, userById, openThread, messageFilterQuery } from '../store';
import MessageRows from './MessageRows';
import './MessageList.css';

export default function MessageList() {
  const messages = createMemo(() => {
    const v = activeView();
    if (!v) return [];
    const all = messagesByChannel[v.id] ?? [];
    const query = messageFilterQuery().trim().toLowerCase();
    if (!query) return all;
    return all.filter((m) => m.text?.toLowerCase().includes(query));
  });

  const channelName = createMemo(() => {
    const v = activeView();
    if (!v) return '';
    if (v.kind === 'channel') return channelById(v.id)?.name ?? '';
    const dm = dmById(v.id);
    return dm ? userById(dm.userId)?.name ?? '' : '';
  });

  return (
    <div class="message-list">
      <div class="message-list-intro">
        <div class="message-list-intro-icon">#</div>
        <h2>{channelName()}</h2>
        <p>This is the very beginning of your conversation. Say hello!</p>
      </div>

      <Show when={activeView()}>
        {(v) => (
          <MessageRows
            messages={messages()}
            channelId={v().id}
            location={{ store: 'channel', key: v().id }}
            onOpenThread={(ts) => openThread(v().id, ts)}
          />
        )}
      </Show>
    </div>
  );
}
