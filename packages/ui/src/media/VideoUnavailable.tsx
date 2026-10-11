import Icon from "./Icon";

export default function VideoUnavailable(props: {
  class?: string;
  href: string;
  onRetry: () => void;
}) {
  return (
    <div class={`video-player-error flex-col gap-sm ${props.class ?? ""}`}>
      <Icon name="video-off" size={22} />
      <span>Video unavailable</span>
      <span class="video-player-actions">
        <button class="video-player-action btn-reset" onClick={props.onRetry} type="button">
          Try again
        </button>
        <a class="video-player-action" href={props.href} rel="noopener noreferrer" target="_blank">
          Open video
        </a>
      </span>
    </div>
  );
}
