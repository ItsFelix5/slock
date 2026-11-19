import { type JSX, Show } from "solid-js";
import IconButton from "../../button/IconButton";
import Icon from "../Icon";

const pipSupported = typeof document !== "undefined" && document.pictureInPictureEnabled;

export default function VideoPlayerCorner(props: {
  downloadHref: string | undefined;
  downloadName: string | undefined;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  toolbarExtra: JSX.Element;
  video: () => HTMLVideoElement | undefined;
}) {
  const togglePip = async () => {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await props.video()?.requestPictureInPicture();
    } catch {}
  };

  return (
    <div class="video-player-corner flex-align-center">
      {props.toolbarExtra}
      <a
        aria-label="Download"
        class="btn-reset icon-btn icon-action video-player-chrome sm"
        download={props.downloadName ?? ""}
        href={props.downloadHref}
        rel="noopener noreferrer"
        target="_blank"
      >
        <Icon name="download" size={14} />
      </a>
      <Show when={pipSupported}>
        <IconButton
          class="video-player-chrome"
          hideTooltip
          icon="open-in-window"
          iconSize={14}
          label="Picture in picture"
          onClick={togglePip}
          size="sm"
        />
      </Show>
      <IconButton
        class="video-player-chrome"
        hideTooltip
        icon={props.fullscreen ? "reduce-diagonal" : "expand-diagonal"}
        iconSize={14}
        label={props.fullscreen ? "Exit fullscreen" : "Fullscreen"}
        onClick={props.onToggleFullscreen}
        size="sm"
      />
    </div>
  );
}
