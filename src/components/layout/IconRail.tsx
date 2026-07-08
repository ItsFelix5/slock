import { Show } from "solid-js";
import Icon, { type IconName } from "../../icons";
import { currentUser } from "../../lib/store";
import { Avatar } from "../common";
import "./IconRail.css";

const items: { key: string; label: string; icon: IconName }[] = [
  { key: "home", label: "Home", icon: "home" },
  { key: "dms", label: "DMs", icon: "direct-messages-filled" },
  { key: "activity", label: "Activity", icon: "notifications" },
  { key: "more", label: "More", icon: "ellipsis-horizontal-filled" },
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
          {(user) => <Avatar user={user()} size="medium" showPresence />}
        </Show>
      </div>
    </div>
  );
}
