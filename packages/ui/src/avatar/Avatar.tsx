import { createSignal, Show } from "solid-js";
import "./Avatar.css";

export const DEFAULT_AVATAR_COLOR = "#616061";

export interface AvatarUser {
  avatarColor: string;
  avatarUrl?: string;
  id: string;
  isBot?: boolean;
  name: string;
  presence?: "active" | "away";
}

export interface AvatarProps {
  showPresence?: boolean;
  size?: "small" | "medium" | "large" | "message";
  user: AvatarUser;
}

export function AvatarImage(props: { alt?: string; avatarUrl: string | undefined }) {
  const [imageFailed, setImageFailed] = createSignal(false);

  return (
    <>
      <Show when={!props.avatarUrl || imageFailed()}>
        <span aria-hidden="true" class="avatar-fallback">
          ?
        </span>
      </Show>
      <Show when={props.avatarUrl && !imageFailed()}>
        <img
          alt={props.alt ?? ""}
          class="avatar-img"
          fetchpriority="low"
          loading="lazy"
          onError={() => setImageFailed(true)}
          src={props.avatarUrl}
        />
      </Show>
    </>
  );
}

export default function Avatar(props: AvatarProps) {
  const sizeClass = () => `avatar-${props.size ?? "medium"}`;
  const presenceClass = () => (props.user.presence === "away" ? "away" : "");

  return (
    <span class={`avatar ${sizeClass()}`} style={{ background: props.user.avatarColor }}>
      <AvatarImage avatarUrl={props.user.avatarUrl} />
      <Show when={props.showPresence && !props.user.isBot && props.user.presence}>
        <span class={`avatar-presence-dot ${presenceClass()}`} />
      </Show>
    </span>
  );
}
