import { Show } from 'solid-js';
import { activeView, channelById, dmById, userById } from '../store';
import EmojiText from './EmojiText';
import Icon from '../icons';
import './ChannelHeader.css';

export default function ChannelHeader() {
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

  return (
    <div class="channel-header">
      <div class="channel-header-top">
        <button class="channel-header-star" title="Star">
          <Icon name="star" size={16} />
        </button>
        <span class="channel-header-icon">
          <Show when={activeView()?.kind !== 'dm'} fallback={null}>
            {isPrivate() ? <Icon name="lock" size={14} /> : '#'}
          </Show>
        </span>
        <span class="channel-header-title">{title()}</span>
        <Show when={topic()}>
          <span class="channel-header-topic">
            <EmojiText text={topic()} />
          </span>
        </Show>
        <div class="channel-header-actions">
          <button class="channel-header-btn" title="Notifications">
            <Icon name="notifications" size={17} />
          </button>
          <button class="channel-header-btn" title="Search">
            <Icon name="search" size={16} />
          </button>
          <button class="channel-header-btn" title="More">
            <Icon name="moreVertical" size={16} />
          </button>
        </div>
      </div>
      <div class="channel-header-tabs">
        <button class="channel-tab active">Messages</button>
        <button class="channel-tab">Add canvas</button>
        <button class="channel-tab">
          <Icon name="plus" size={14} />
        </button>
      </div>
    </div>
  );
}
