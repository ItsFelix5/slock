import { Show } from "solid-js";
import "./Avatar.css";

export interface AvatarUser {
  avatarColor: string;
  avatarUrl?: string;
  id: string;
  name: string;
  presence?: "active" | "away";
}

export interface AvatarProps {
  showPresence?: boolean;
  size?: "small" | "medium" | "large";
  user: AvatarUser;
}

export default function Avatar(props: AvatarProps) {
  const sizeClass = () => `avatar-${props.size ?? "medium"}`;
  const presenceClass = () => (props.user.presence === "away" ? "away" : "");

  return (
    <span class={`avatar ${sizeClass()}`} style={{ background: props.user.avatarColor }}>
      <img
        alt="?"
        class="avatar-img"
        fetchpriority="low"
        loading="lazy"
        src={props.user.avatarUrl}
      />
      <Show when={props.showPresence}>
        <span class={`avatar-presence-dot ${presenceClass()}`} />
      </Show>
    </span>
  );
}
