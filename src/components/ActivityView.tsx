import { For, Show, createMemo, createSignal, onMount } from 'solid-js';
import {
  activityItems,
  ensureActivityLoaded,
  markActivityRead,
  lastActivityReadAt,
  userById,
  channelById,
  setActiveView,
  openThread,
} from '../store';
import Mrkdwn from '../blockkit/mrkdwn';
import Pronouns from './Pronouns';
import './ActivityView.css';

type FilterKind = 'all' | 'mention' | 'reaction';

const FILTERS: { key: FilterKind; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'mention', label: 'Mentions' },
  { key: 'reaction', label: 'Reactions' },
];

export default function ActivityView() {
  const [filter, setFilter] = createSignal<FilterKind>('all');

  onMount(() => ensureActivityLoaded());

  const items = createMemo(() => {
    const sorted = [...activityItems].sort((a, b) => b.time - a.time);
    const f = filter();
    return f === 'all' ? sorted : sorted.filter((i) => i.kind === f);
  });

  const goTo = (channelId: string, ts: string) => {
    setActiveView({ kind: 'channel', id: channelId });
    openThread(channelId, ts);
  };

  return (
    <div class="activity-view">
      <div class="activity-view-header">
        <h2>Activity</h2>
        <button class="activity-mark-read" onClick={markActivityRead}>
          Mark all as read
        </button>
      </div>
      <div class="activity-filters">
        <For each={FILTERS}>
          {(f) => (
            <button
              class="activity-filter-btn"
              classList={{ active: filter() === f.key }}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          )}
        </For>
      </div>
      <Show when={items().length > 0} fallback={<div class="activity-empty">Nothing here yet.</div>}>
        <For each={items()}>
          {(item) => {
            const user = createMemo(() => userById(item.userId));
            const channel = createMemo(() => channelById(item.channelId));
            const isUnread = createMemo(() => item.time > lastActivityReadAt());
            return (
              <button class="activity-item" classList={{ unread: isUnread() }} onClick={() => goTo(item.channelId, item.ts)}>
                <span class="activity-unread-dot" />
                <div class="activity-avatar" style={{ background: user()?.avatarColor ?? '#616061' }}>
                  <Show when={user()?.avatarUrl} fallback={user()?.initials ?? '?'}>
                    {(url) => <img src={url()} alt="" />}
                  </Show>
                </div>
                <div class="activity-body">
                  <div class="activity-headline">
                    <strong>{user()?.name ?? 'Someone'}</strong>
                    <Pronouns text={user()?.pronouns} />{' '}
                    {item.kind === 'mention' ? 'mentioned you in' : 'reacted to your message in'}{' '}
                    <span class="activity-channel">#{channel()?.name ?? item.channelId}</span>
                  </div>
                  <div class="activity-snippet">
                    <Mrkdwn text={item.text} />
                  </div>
                  <div class="activity-time">{new Date(item.time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div>
                </div>
              </button>
            );
          }}
        </For>
      </Show>
    </div>
  );
}
