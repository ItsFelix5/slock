import { For, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import type { Channel, DirectMessage } from '../types';
import {
  sections,
  channels,
  directMessages,
  userById,
  activeView,
  setActiveView,
  nav,
  setNavView,
  currentUser,
  openUserProfile,
  openDmWithUser,
  closeDmConversation,
  unreadChannelIds,
  isChannelLeft,
  hasUnreadPing,
  hasUnreadGlow,
  openBrowseChannels,
  isChannelMuted,
  type Nav,
} from '../store';
import Icon, { type IconName } from '../icons';
import ResizeHandle from './ResizeHandle';
import ComposeUserPicker from './ComposeUserPicker';
import GlobalSearch from './GlobalSearch';
import './Sidebar.css';

const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 420;

const NAV_ITEMS: { key: Nav; label: string; icon: IconName }[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'activity', label: 'Activity', icon: 'notifications' },
  { key: 'later', label: 'Later', icon: 'bookmark' },
];

interface Category {
  id: string;
  name: string;
  channels: Channel[];
}

function DmRow(props: { dm: DirectMessage }) {
  const user = createMemo(() => userById(props.dm.userId));
  const isActive = createMemo(() => {
    const v = activeView();
    return nav() === 'home' && v?.kind === 'dm' && v.id === props.dm.id;
  });

  return (
    <Show when={user()}>
      {(u) => (
        <div class="sidebar-row-wrap">
          <button
            class="sidebar-row"
            classList={{ active: isActive(), unread: !!unreadChannelIds[props.dm.id] }}
            onClick={() => setActiveView({ kind: 'dm', id: props.dm.id })}
          >
            <span class="sidebar-row-avatar" style={{ background: u().avatarColor }}>
              <Show when={u().avatarUrl} fallback={u().initials}>
                {(url) => <img class="sidebar-row-avatar-img" src={url()} alt="" />}
              </Show>
              <span class="sidebar-presence-dot" classList={{ away: u().presence === 'away' }} />
            </span>
            <span class="sidebar-row-name">{u().name}</span>
          </button>
          <button
            class="sidebar-row-close"
            title="Close conversation"
            onClick={(e) => {
              e.stopPropagation();
              closeDmConversation(props.dm.id);
            }}
          >
            <Icon name="close" size={12} />
          </button>
        </div>
      )}
    </Show>
  );
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = createSignal<Set<string>>(new Set());
  const [dmsOpen, setDmsOpen] = createSignal(true);
  const [appsOpen, setAppsOpen] = createSignal(true);
  const [width, setWidth] = createSignal(DEFAULT_WIDTH);
  const [query, setQuery] = createSignal('');
  const [composeOpen, setComposeOpen] = createSignal(false);
  const [searchOpen, setSearchOpen] = createSignal(false);
  const [unreadsOnly, setUnreadsOnly] = createSignal(false);

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    onCleanup(() => window.removeEventListener('keydown', onKey));
  });

  const toggleCategory = (id: string) => {
    const next = new Set(collapsed());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCollapsed(next);
  };

  const categories = createMemo<Category[]>(() => {
    const allChannels = channels().filter((c) => !isChannelLeft(c.id));
    const filter = query().trim().toLowerCase();
    const matches = (c: Channel) =>
      (!filter || c.name.toLowerCase().includes(filter)) && (!unreadsOnly() || c.unread || !!unreadChannelIds[c.id]);
    const secs = sections();

    if (!secs || secs.length === 0) {
      return [{ id: 'channels', name: 'Channels', channels: allChannels.filter(matches) }];
    }

    const byId = new Map(allChannels.map((c) => [c.id, c]));
    const used = new Set<string>();
    const groups: Category[] = secs.map((s) => {
      for (const id of s.channelIds) used.add(id);
      return {
        id: s.id,
        name: s.name,
        channels: s.channelIds.map((id) => byId.get(id)).filter((c): c is Channel => !!c && matches(c)),
      };
    });
    const rest = allChannels.filter((c) => !used.has(c.id) && matches(c));
    if (rest.length) groups.push({ id: '__rest', name: 'Channels', channels: rest });
    return groups;
  });

  const filteredDms = createMemo(() => {
    const filter = query().trim().toLowerCase();
    return directMessages().filter((dm) => {
      if (unreadsOnly() && !dm.unread && !unreadChannelIds[dm.id]) return false;
      if (!filter) return true;
      const u = userById(dm.userId);
      return u?.name.toLowerCase().includes(filter);
    });
  });

  const peopleDms = createMemo(() => filteredDms().filter((dm) => !userById(dm.userId)?.isBot));
  const appDms = createMemo(() => filteredDms().filter((dm) => userById(dm.userId)?.isBot));

  return (
    <div class="sidebar" style={{ width: `${width()}px` }}>
      <ResizeHandle width={width} setWidth={setWidth} min={MIN_WIDTH} max={MAX_WIDTH} direction={1} side="right" />

      <div class="sidebar-top">
        <Show when={currentUser()}>
          {(user) => (
            <button
              class="sidebar-me"
              title={`${user().name} — view your profile`}
              onClick={() => openUserProfile(user().id)}
            >
              <span class="sidebar-me-avatar" style={{ background: user().avatarColor }}>
                <Show when={user().avatarUrl} fallback={user().initials}>
                  {(url) => <img src={url()} alt="" />}
                </Show>
                <span class="presence-dot" classList={{ away: user().presence === 'away' }} />
              </span>
              <span class="sidebar-me-name">{user().name}</span>
            </button>
          )}
        </Show>
        <button class="sidebar-global-search-btn" title="Search (Ctrl+K)" onClick={() => setSearchOpen(true)}>
          <Icon name="search" size={16} />
        </button>
      </div>

      <Show when={searchOpen()}>
        <GlobalSearch onClose={() => setSearchOpen(false)} />
      </Show>

      <div class="sidebar-nav">
        <For each={NAV_ITEMS}>
          {(item) => (
            <button
              class="sidebar-nav-btn"
              classList={{
                active: nav() === item.key,
                'has-glow': item.key === 'activity' && hasUnreadGlow(),
              }}
              onClick={() => setNavView(item.key)}
            >
              <Icon name={item.icon} size={16} />
              {item.label}
              <Show when={item.key === 'activity' && hasUnreadPing()}>
                <span class="sidebar-ping-dot" />
              </Show>
            </button>
          )}
        </For>
      </div>

      <div class="sidebar-search">
        <input
          class="sidebar-search-input"
          type="text"
          placeholder="Filter channels & DMs"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
        <button
          class="sidebar-search-icon-btn"
          classList={{ active: unreadsOnly() }}
          title={unreadsOnly() ? 'Show all' : 'Show unreads only'}
          onClick={() => setUnreadsOnly(!unreadsOnly())}
        >
          <span class="sidebar-unread-filter-dot" />
        </button>
        <button class="sidebar-search-icon-btn" title="Browse or create channels" onClick={openBrowseChannels}>
          <Icon name="plus" size={14} />
        </button>
      </div>

      <div class="sidebar-scroll">
        <For each={categories()}>
          {(cat) => (
            <Show when={cat.channels.length > 0 || !query()}>
              <div class="sidebar-section">
                <div class="sidebar-section-header">
                  <button class="sidebar-section-header-btn" onClick={() => toggleCategory(cat.id)}>
                    <span class="sidebar-caret" classList={{ collapsed: collapsed().has(cat.id) }}>
                      ▾
                    </span>
                    {cat.name}
                  </button>
                </div>
                <div style={{ display: collapsed().has(cat.id) ? 'none' : 'block' }}>
                  <For each={cat.channels}>
                    {(ch) => {
                      const isActive = createMemo(() => {
                        const v = activeView();
                        return nav() === 'home' && v?.kind === 'channel' && v.id === ch.id;
                      });
                      const isUnread = createMemo(() => !!unreadChannelIds[ch.id]);
                      const muted = createMemo(() => isChannelMuted(ch.id));
                      return (
                        <button
                          class="sidebar-row"
                          classList={{ active: isActive(), unread: isUnread() && !muted(), muted: muted() }}
                          onClick={() => setActiveView({ kind: 'channel', id: ch.id })}
                        >
                          <span class="sidebar-row-icon">{ch.private ? <Icon name="lock" size={13} /> : '#'}</span>
                          <span class="sidebar-row-name">{ch.name}</span>
                          {!muted() && ch.mentions ? <span class="sidebar-badge">{ch.mentions}</span> : null}
                        </button>
                      );
                    }}
                  </For>
                </div>
              </div>
            </Show>
          )}
        </For>

        <div class="sidebar-section">
          <div class="sidebar-section-header">
            <button class="sidebar-section-header-btn" onClick={() => setDmsOpen(!dmsOpen())}>
              <span class="sidebar-caret" classList={{ collapsed: !dmsOpen() }}>
                ▾
              </span>
              Direct messages
            </button>
            <span class="sidebar-compose-wrap">
              <button
                class="sidebar-compose"
                title="New message"
                onClick={() => setComposeOpen(!composeOpen())}
              >
                <Icon name="compose" size={14} />
              </button>
              <Show when={composeOpen()}>
                <ComposeUserPicker
                  onSelect={(id) => {
                    openDmWithUser(id);
                    setComposeOpen(false);
                  }}
                  onClose={() => setComposeOpen(false)}
                />
              </Show>
            </span>
          </div>
          <div style={{ display: dmsOpen() ? 'block' : 'none' }}>
            <For each={peopleDms()}>{(dm) => <DmRow dm={dm} />}</For>
          </div>
        </div>

        <Show when={appDms().length > 0}>
          <div class="sidebar-section">
            <div class="sidebar-section-header">
              <button class="sidebar-section-header-btn" onClick={() => setAppsOpen(!appsOpen())}>
                <span class="sidebar-caret" classList={{ collapsed: !appsOpen() }}>
                  ▾
                </span>
                Apps
              </button>
            </div>
            <div style={{ display: appsOpen() ? 'block' : 'none' }}>
              <For each={appDms()}>{(dm) => <DmRow dm={dm} />}</For>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
