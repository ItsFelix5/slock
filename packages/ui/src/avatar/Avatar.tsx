import { Show } from "solid-js";
import "./Avatar.css";

export interface AvatarUser {
  id: string;
  name: string;
  avatarUrl?: string;
  avatarColor: string;
  presence?: "active" | "away";
}

export interface AvatarProps {
  user: AvatarUser;
  size?: "small" | "medium" | "large";
  showPresence?: boolean;
}

export default function Avatar(props: AvatarProps) {
  const sizeClass = () => `avatar-${props.size || "medium"}`;
  const presenceClass = () => (props.user.presence === "away" ? "away" : "");

  return (
    <span class={`avatar ${sizeClass()}`} style={{ background: props.user.avatarColor }}>
      <img class="avatar-img" src={props.user.avatarUrl} alt="?" loading="lazy" />
      <Show when={props.showPresence}>
        <span class={`avatar-presence-dot ${presenceClass()}`} />
      </Show>
    </span>
  );
}
