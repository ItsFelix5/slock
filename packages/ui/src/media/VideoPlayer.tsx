import { createEffect, createSignal, on, Show } from "solid-js";
import Icon from "./Icon";
import "./VideoPlayer.css";

export interface VideoPlayerProps {
  ariaLabel: string;
  class?: string;
  height?: number;
  openHref?: string;
  poster?: string;
  src: string;
  width?: number;
}

export default function VideoPlayer(props: VideoPlayerProps) {
  const [failed, setFailed] = createSignal(false);

  createEffect(
    on(
      () => props.src,
      () => setFailed(false),
      { defer: true },
    ),
  );

  return (
    <Show
      fallback={
        <div class={`video-player-error ${props.class ?? ""}`}>
          <Icon name="video-off" size={22} />
          <span>Video unavailable</span>
          <span class="video-player-actions">
            <button
              class="video-player-action btn-reset"
              onClick={() => setFailed(false)}
              type="button"
            >
              Try again
            </button>
            <a
              class="video-player-action"
              href={props.openHref ?? props.src}
              rel="noopener noreferrer"
              target="_blank"
            >
              Open video
            </a>
          </span>
        </div>
      }
      when={!failed()}
    >
      <video
        aria-label={props.ariaLabel}
        class={props.class}
        controls
        height={props.height}
        onError={() => setFailed(true)}
        poster={props.poster}
        preload="metadata"
        src={props.src}
        width={props.width}
      />
    </Show>
  );
}
