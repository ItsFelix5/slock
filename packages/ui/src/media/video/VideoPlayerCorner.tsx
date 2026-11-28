import type { JSX } from "@solidjs/web";
import { Show } from "solid-js";
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
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else {
      const video = props.video();
      if (video && video.readyState > 0) await video.requestPictureInPicture();
    }
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
          icon="open-in-window"
          iconSize={14}
          onClick={togglePip}
          size="sm"
        />
      </Show>
      <IconButton
        class="video-player-chrome"
        icon={props.fullscreen ? "reduce-diagonal" : "expand-diagonal"}
        iconSize={14}
        onClick={props.onToggleFullscreen}
        size="sm"
      />
    </div>
  );
}
