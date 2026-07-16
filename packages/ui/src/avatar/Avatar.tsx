import { createSignal, Show } from "solid-js";
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
  const [imageFailed, setImageFailed] = createSignal(false);
  const sizeClass = () => `avatar-${props.size ?? "medium"}`;
  const presenceClass = () => (props.user.presence === "away" ? "away" : "");

  return (
    <span class={`avatar ${sizeClass()}`} style={{ background: props.user.avatarColor }}>
      <Show when={!props.user.avatarUrl || imageFailed()}>
        <span aria-hidden="true" class="avatar-fallback">
          ?
        </span>
      </Show>
      <Show when={props.user.avatarUrl && !imageFailed()}>
        <img
          alt=""
          class="avatar-img"
          fetchpriority="low"
          loading="lazy"
          onError={() => setImageFailed(true)}
          src={props.user.avatarUrl}
        />
      </Show>
      <Show when={props.showPresence}>
        <span class={`avatar-presence-dot ${presenceClass()}`} />
      </Show>
    </span>
  );
}
