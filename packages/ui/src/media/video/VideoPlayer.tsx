import type { JSX } from "@solidjs/web";
import { Show } from "solid-js";
import IconButton from "../../button/IconButton";
import { FloatingMountContext } from "../../overlay/floating/FloatingPanel";
import { mediaBoxStyle } from "../image/mediaDimensions";
import { fileSrc, imageSrc } from "../mediaSrc";
import { createVideoPlayback } from "./createVideoPlayback";
import "./VideoPlayer.css";
import VideoPlayerCorner from "./VideoPlayerCorner";
import VideoSeekBar from "./VideoSeekBar";
import VideoSpeedMenu from "./VideoSpeedMenu";
import VideoUnavailable from "./VideoUnavailable";
import VolumeControl from "./VolumeControl";
import { formatDuration } from "./videoTime";

export interface VideoPlayerProps {
  ariaLabel: string;
  captionsSrc?: string;
  class?: string;
  downloadHref?: string;
  downloadName?: string;
  duration?: number;
  height?: number;
  openHref?: string;
  poster?: string;
  ref?: (element: HTMLVideoElement) => void;
  src: string;
  toolbarExtra?: JSX.Element;
  width?: number;
}

export default function VideoPlayer(props: VideoPlayerProps) {
  const playback = createVideoPlayback({
    duration: () => props.duration,
    src: () => props.src,
  });
  const { mediaVolume } = playback;

  return (
    <Show
      fallback={
        <VideoUnavailable
          class={props.class}
          href={fileSrc(props.openHref ?? props.src)}
          onRetry={playback.retry}
        />
      }
      when={!playback.failed()}
    >
      <div
        class="video-player-wrap"
        ref={playback.setWrapRef}
        style={
          props.width && props.height && !playback.fullscreen()
            ? mediaBoxStyle(props.width, props.height)
            : undefined
        }
      >
        <FloatingMountContext
          value={() => (playback.fullscreen() ? playback.wrapElement() : undefined)}
        >
          <video
            aria-label={props.ariaLabel}
            class={props.class}
            onClick={() => {
              playback.togglePlayback();
              playback.focusSeek();
            }}
            {...playback.videoEvents}
            poster={imageSrc(props.poster)}
            preload={props.poster && props.duration ? "none" : "metadata"}
            ref={(element) => {
              playback.setVideoRef(element);
              props.ref?.(element);
            }}
            src={fileSrc(props.src)}
          >
            <Show when={props.captionsSrc}>
              {(src) => (
                <track kind="captions" label="Transcript" src={fileSrc(src())} srclang="en" />
              )}
            </Show>
          </video>

          <div class="video-player-idle flex-align-center">
            <IconButton
              aria-hidden="true"
              circular
              class="video-player-chrome"
              icon={playback.playing() ? "pause-filled" : "play-filled"}
              iconSize={12}
              onClick={playback.togglePlayback}
              size="sm"
              tabindex={-1}
            />
            <Show when={playback.duration()}>
              <span class="video-player-time">
                {formatDuration(
                  playback.currentTime() > 0 ? playback.currentTime() : playback.duration(),
                )}
              </span>
            </Show>
          </div>

          <VideoPlayerCorner
            downloadHref={props.downloadHref ?? props.openHref}
            downloadName={props.downloadName}
            fullscreen={playback.fullscreen()}
            onToggleFullscreen={playback.toggleFullscreen}
            toolbarExtra={props.toolbarExtra}
            video={playback.video}
          />

          <div class="video-player-controls flex-col">
            <VideoSeekBar
              buffered={playback.buffered()}
              currentTime={playback.currentTime()}
              duration={playback.duration()}
              onScrub={playback.startScrub}
              progress={playback.progress()}
              ref={playback.setSeekRef}
              valueText={`${formatDuration(playback.currentTime())} of ${formatDuration(playback.duration())}`}
            />

            <div class="video-player-controls-row flex-align-center">
              <IconButton
                class="video-player-chrome"
                hideTooltip
                icon={playback.playing() ? "pause-filled" : "play-filled"}
                iconSize={15}
                label={playback.playing() ? "Pause" : "Play"}
                onClick={playback.togglePlayback}
                size="sm"
              />

              <span class="video-player-time">{formatDuration(playback.currentTime())}</span>

              <VolumeControl
                muted={mediaVolume.muted()}
                onMutedChange={mediaVolume.setMuted}
                onVolumeChange={mediaVolume.setVolume}
                volume={mediaVolume.volume()}
              />

              <div class="video-player-row-spacer" />

              <div class="video-player-meta-group flex-align-center">
                <VideoSpeedMenu onSpeed={playback.applySpeed} speed={playback.speed()} />

                <Show when={props.captionsSrc}>
                  <IconButton
                    active={playback.captionsOn()}
                    class="video-player-chrome"
                    hideTooltip
                    icon={playback.captionsOn() ? "closed-caption-filled" : "closed-caption"}
                    iconSize={14}
                    label="Captions"
                    onClick={playback.toggleCaptions}
                    size="sm"
                  />
                </Show>
              </div>
            </div>
          </div>
        </FloatingMountContext>
      </div>
    </Show>
  );
}
