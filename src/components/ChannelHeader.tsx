import { Show, createEffect, createSignal } from 'solid-js';
import {
  activeView,
  channelById,
  dmById,
  userById,
  isChannelStarred,
  toggleChannelStar,
  leaveCurrentChannel,
  markCurrentChannelRead,
  messageFilterQuery,
  setMessageFilterQuery,
  openUserProfile,
  isChannelMuted,
  toggleMuteChannel,
  openPinnedPanel,
  canvasByChannel,
  ensureCanvasChecked,
  openChannelCanvas,
  createCanvasForCurrentChannel,
} from '../store';
import EmojiText from './EmojiText';
import Icon from '../icons';
import './ChannelHeader.css';

export default function ChannelHeader() {
  const [searchOpen, setSearchOpen] = createSignal(false);
  const [moreOpen, setMoreOpen] = createSignal(false);

  createEffect(() => {
    const v = activeView();
    if (v?.kind === 'channel') ensureCanvasChecked(v.id);
  });

  const title = () => {
    const v = activeView();
    if (!v) return '';
    if (v.kind === 'channel') return channelById(v.id)?.name ?? '';
    const dm = dmById(v.id);
    return dm ? userById(dm.userId)?.name ?? '' : '';
  };

  const topic = () => {
    const v = activeView();
    if (!v) return '';
    if (v.kind === 'channel') return channelById(v.id)?.topic ?? '';
    return 'Direct message';
  };

  const isPrivate = () => {
    const v = activeView();
    return v?.kind === 'channel' && !!channelById(v.id)?.private;
  };

  const isChannel = () => activeView()?.kind === 'channel';
  const starred = () => {
    const v = activeView();
    return v?.kind === 'channel' && isChannelStarred(v.id);
  };
  const muted = () => {
    const v = activeView();
    return !!v && isChannelMuted(v.id);
  };
  const canvas = () => {
    const v = activeView();
    return v?.kind === 'channel' ? canvasByChannel[v.id] : undefined;
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setMessageFilterQuery('');
  };

  const viewDmUser = () => {
    const v = activeView();
    if (v?.kind !== 'dm') return;
    const dm = dmById(v.id);
    if (dm) openUserProfile(dm.userId);
  };

  return (
    <div class="channel-header">
      <div class="channel-header-top">
        <Show when={isChannel()}>
          <button
            class="channel-header-star"
            classList={{ active: starred() }}
            title={starred() ? 'Remove from starred' : 'Star channel'}
            onClick={() => activeView() && toggleChannelStar(activeView()!.id)}
          >
            <Icon name="star" size={16} />
          </button>
        </Show>
        <span class="channel-header-icon">
          <Show when={activeView()?.kind !== 'dm'} fallback={null}>
            {isPrivate() ? <Icon name="lock" size={14} /> : '#'}
          </Show>
        </span>
        <Show when={!isChannel()} fallback={<span class="channel-header-title">{title()}</span>}>
          <button class="channel-header-title channel-header-title-btn" onClick={viewDmUser}>
            {title()}
          </button>
        </Show>
        <Show when={topic()}>
          <span class="channel-header-topic">
            <EmojiText text={topic()} />
          </span>
        </Show>
        <div class="channel-header-actions">
          <Show when={isChannel() && canvas()}>
            <button class="channel-header-btn" title="Canvas" onClick={() => activeView() && openChannelCanvas(activeView()!.id)}>
              <Icon name="codeBlock" size={16} />
            </button>
          </Show>
          <button class="channel-header-btn" classList={{ active: searchOpen() }} title="Search in conversation" onClick={() => setSearchOpen(!searchOpen())}>
            <Icon name="search" size={16} />
          </button>
          <Show when={isChannel()}>
            <div class="channel-header-more-wrap">
              <button class="channel-header-btn" title="More" onClick={() => setMoreOpen(!moreOpen())}>
                <Icon name="moreVertical" size={16} />
              </button>
              <Show when={moreOpen()}>
                <div class="channel-header-menu">
                  <button
                    class="channel-header-menu-item"
                    onClick={() => {
                      setMoreOpen(false);
                      if (activeView()) markCurrentChannelRead(activeView()!.id);
                    }}
                  >
                    Mark as read
                  </button>
                  <button
                    class="channel-header-menu-item"
                    onClick={() => {
                      setMoreOpen(false);
                      if (activeView()) openPinnedPanel(activeView()!.id);
                    }}
                  >
                    View pinned items
                  </button>
                  <button
                    class="channel-header-menu-item"
                    onClick={() => {
                      setMoreOpen(false);
                      if (activeView()) toggleMuteChannel(activeView()!.id);
                    }}
                  >
                    {muted() ? 'Unmute channel' : 'Mute channel'}
                  </button>
                  <Show when={!canvas()}>
                    <button
                      class="channel-header-menu-item"
                      onClick={() => {
                        setMoreOpen(false);
                        if (activeView()) createCanvasForCurrentChannel(activeView()!.id);
                      }}
                    >
                      Create canvas
                    </button>
                  </Show>
                  <button
                    class="channel-header-menu-item"
                    onClick={() => {
                      setMoreOpen(false);
                      navigator.clipboard.writeText(`${location.origin}/#${activeView()?.id}`);
                    }}
                  >
                    Copy link to channel
                  </button>
                  <button
                    class="channel-header-menu-item danger"
                    onClick={() => {
                      setMoreOpen(false);
                      const v = activeView();
                      if (v && confirm(`Leave #${title()}?`)) leaveCurrentChannel(v.id);
                    }}
                  >
                    Leave channel
                  </button>
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </div>
      <Show when={searchOpen()}>
        <div class="channel-header-search">
          <input
            class="channel-header-search-input"
            type="text"
            placeholder="Search in this conversation"
            value={messageFilterQuery()}
            onInput={(e) => setMessageFilterQuery(e.currentTarget.value)}
            autofocus
          />
          <button class="channel-header-search-close" onClick={closeSearch} title="Close search">
            ✕
          </button>
        </div>
      </Show>
    </div>
  );
}
