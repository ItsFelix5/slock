import { Show } from 'solid-js';
import { currentUser } from '../../lib/store';
import Icon, { type IconName } from '../../icons';
import './IconRail.css';

const items: { key: string; label: string; icon: IconName }[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'dms', label: 'DMs', icon: 'dms' },
  { key: 'activity', label: 'Activity', icon: 'notifications' },
  { key: 'more', label: 'More', icon: 'more' },
];

export default function IconRail() {
  return (
    <div class="icon-rail">
      <div class="icon-rail-workspace">HC</div>
      <div class="icon-rail-items">
        {items.map((item, i) => (
          <button class="icon-rail-btn" classList={{ active: i === 0 }} title={item.label}>
            <Icon name={item.icon} size={20} />
            <span class="icon-rail-label">{item.label}</span>
          </button>
        ))}
      </div>
      <div class="icon-rail-bottom">
        <button class="icon-rail-add" title="Add workspace">
          <Icon name="plus" size={16} />
        </button>
        <Show when={currentUser()}>
          {(user) => (
            <div class="icon-rail-avatar" style={{ background: user().avatarColor }}>
              <Show when={user().avatarUrl} fallback={user().initials}>
                {(url) => <img class="icon-rail-avatar-img" src={url()} alt="" />}
              </Show>
              <span class="presence-dot" />
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}
