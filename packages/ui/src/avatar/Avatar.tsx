import { createSignal, Show } from "solid-js";
import "./Avatar.css";

// Slack's own fallback color for users whose avatarColor wasn't loaded
// (e.g. a lightweight message-author summary missing full user data).
export const DEFAULT_AVATAR_COLOR = "#616061";

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
      <Show when={props.showPresence && props.user.presence}>
        <span class={`avatar-presence-dot ${presenceClass()}`} />
      </Show>
    </span>
  );
}
