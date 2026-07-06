import { For, Show, createMemo, createSignal } from 'solid-js';
import { bootstrap, userById, activeView, setActiveView } from '../store';
import Icon, { type IconName } from '../icons';
import ResizeHandle from './ResizeHandle';
import './Sidebar.css';

const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 420;

const topLinks: { icon: IconName; label: string }[] = [
  { icon: 'threads', label: 'Threads' },
  { icon: 'compose', label: 'Drafts & sent' },
];

export default function Sidebar() {
  const [channelsOpen, setChannelsOpen] = createSignal(true);
  const [dmsOpen, setDmsOpen] = createSignal(true);
  const [width, setWidth] = createSignal(DEFAULT_WIDTH);

  return (
    <div class="sidebar" style={{ width: `${width()}px` }}>
      <ResizeHandle width={width} setWidth={setWidth} min={MIN_WIDTH} max={MAX_WIDTH} direction={1} side="right" />
      <div class="sidebar-header">
        <span class="sidebar-title">{bootstrap()?.currentUser ? 'Hack Club' : 'Loading…'}</span>
        <Icon name="caretDown" size={14} class="sidebar-chevron" />
        <button class="sidebar-compose" title="Compose">
          <Icon name="compose" size={16} />
        </button>
      </div>

      <div class="sidebar-scroll">
        <For each={topLinks}>
          {(link) => (
            <button class="sidebar-link">
              <span class="sidebar-link-icon">
                <Icon name={link.icon} size={16} />
              </span>
              {link.label}
            </button>
          )}
        </For>

        <div class="sidebar-section">
          <button class="sidebar-section-header" onClick={() => setChannelsOpen(!channelsOpen())}>
            <span class="sidebar-caret" classList={{ collapsed: !channelsOpen() }}>▾</span>
            Channels
          </button>
          <div style={{ display: channelsOpen() ? 'block' : 'none' }}>
            <For each={bootstrap()?.channels ?? []}>
              {(ch) => {
                const isActive = createMemo(() => {
                  const v = activeView();
                  return v?.kind === 'channel' && v.id === ch.id;
                });
                return (
                  <button
                    class="sidebar-row"
                    classList={{ active: isActive(), unread: ch.unread }}
                    onClick={() => setActiveView({ kind: 'channel', id: ch.id })}
                  >
                    <span class="sidebar-row-icon">
                      {ch.private ? <Icon name="lock" size={13} /> : '#'}
                    </span>
                    <span class="sidebar-row-name">{ch.name}</span>
                    {ch.mentions ? <span class="sidebar-badge">{ch.mentions}</span> : null}
                  </button>
                );
              }}
            </For>
          </div>
        </div>

        <div class="sidebar-section">
          <button class="sidebar-section-header" onClick={() => setDmsOpen(!dmsOpen())}>
            <span class="sidebar-caret" classList={{ collapsed: !dmsOpen() }}>▾</span>
            Direct messages
          </button>
          <div style={{ display: dmsOpen() ? 'block' : 'none' }}>
            <For each={bootstrap()?.directMessages ?? []}>
              {(dm) => {
                const user = createMemo(() => userById(dm.userId));
                const isActive = createMemo(() => {
                  const v = activeView();
                  return v?.kind === 'dm' && v.id === dm.id;
                });
                return (
                  <Show when={user()}>
                    {(u) => (
                      <button
                        class="sidebar-row"
                        classList={{ active: isActive(), unread: dm.unread }}
                        onClick={() => setActiveView({ kind: 'dm', id: dm.id })}
                      >
                        <span class="sidebar-row-avatar" style={{ background: u().avatarColor }}>
                          <Show when={u().avatarUrl} fallback={u().initials}>
                            {(url) => <img class="sidebar-row-avatar-img" src={url()} alt="" />}
                          </Show>
                          <span class="sidebar-presence-dot" classList={{ away: u().presence === 'away' }} />
                        </span>
                        <span class="sidebar-row-name">{u().name}</span>
                      </button>
                    )}
                  </Show>
                );
              }}
            </For>
          </div>
        </div>
      </div>
    </div>
  );
}
