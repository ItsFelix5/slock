import { Show } from "solid-js";
import "./Avatar.css";

interface User {
  id: string;
  name: string;
  avatarUrl?: string;
  avatarColor: string;
  initials: string;
  presence?: "active" | "away";
}

export interface AvatarProps {
  user: User;
  size?: "small" | "medium" | "large";
  showPresence?: boolean;
}

export default function Avatar(props: AvatarProps) {
  const sizeClass = () => `avatar-${props.size || "medium"}`;
  const presenceClass = () => (props.user.presence === "away" ? "away" : "");

  return (
    <span class={`avatar ${sizeClass()}`} style={{ background: props.user.avatarColor }}>
      <Show when={props.user.avatarUrl} fallback={props.user.initials}>
        {(url) => <img class="avatar-img" src={url()} alt="" />}
      </Show>
      <Show when={props.showPresence}>
        <span class={`avatar-presence-dot ${presenceClass()}`} />
      </Show>
    </span>
  );
}
