import { createEffect, createSignal, on, onCleanup, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import IconButton from "../../button/IconButton";
import { FloatingMountContext } from "../../overlay/floating/FloatingPanel";
import { startFrameCoalescedPointerDrag } from "../../pointerDrag";
import { mediaBoxStyle } from "../image/mediaDimensions";
import { fileSrc, imageSrc } from "../mediaSrc";
import { createMediaVolume } from "./createMediaVolume";
import "./VideoPlayer.css";
import { useVideoShortcuts } from "./useVideoShortcuts";
import VideoPlayerCorner from "./VideoPlayerCorner";
import VideoSeekBar from "./VideoSeekBar";
import VideoSpeedMenu from "./VideoSpeedMenu";
import VideoUnavailable from "./VideoUnavailable";
import VolumeControl from "./VolumeControl";
import { formatDuration, ratioFromPointer, ratioOf, timeFromRatio } from "./videoTime";

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
  let videoRef: HTMLVideoElement | undefined;
  let wrapRef: HTMLDivElement | undefined;
  let seekRef: HTMLDivElement | undefined;
  let stopScrub: (() => void) | undefined;
  const [videoElement, setVideoElement] = createSignal<HTMLVideoElement>();
  const mediaVolume = createMediaVolume(videoElement);

  const [failed, setFailed] = createSignal(false);
  const [playing, setPlaying] = createSignal(false);
  const [currentTime, setCurrentTime] = createSignal(0);
  const [mediaDuration, setMediaDuration] = createSignal<number>();
  const [buffered, setBuffered] = createSignal(0);
  const [fullscreen, setFullscreen] = createSignal(false);
  const [speed, setSpeed] = createSignal(1);
  const [captionsOn, setCaptionsOn] = createSignal(false);

  const duration = () => props.duration ?? mediaDuration() ?? 0;
  const progress = () => ratioOf(currentTime(), duration());

  createEffect(
    on(
      () => props.src,
      () => {
        setFailed(false);
        setPlaying(false);
        setCurrentTime(0);
      },
      { defer: true },
    ),
  );

  createEffect(() => {
    const onFullscreenChange = () => setFullscreen(document.fullscreenElement === wrapRef);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    onCleanup(() => document.removeEventListener("fullscreenchange", onFullscreenChange));
  });

  const togglePlayback = async () => {
    if (!videoRef) return;
    if (videoRef.paused) {
      try {
        await videoRef.play();
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setFailed(true);
      }
    } else {
      videoRef.pause();
    }
  };

  const seekTo = (ratio: number) => {
    const nextTime = timeFromRatio(ratio, duration());
    if (!videoRef || nextTime === undefined) return;
    videoRef.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const startScrub = (event: PointerEvent & { currentTarget: HTMLElement }) => {
    const rect = event.currentTarget.getBoundingClientRect();
    seekTo(ratioFromPointer(event.clientX, rect));
    stopScrub?.();
    stopScrub = startFrameCoalescedPointerDrag((moveEvent) =>
      seekTo(ratioFromPointer(moveEvent.clientX, rect)),
    );
  };

  useVideoShortcuts({
    currentTime,
    duration,
    root: () => wrapRef,
    seekRoot: () => seekRef,
    seekTo,
    toggleFullscreen: () => toggleFullscreen(),
    toggleMute: () => mediaVolume.setMuted(!mediaVolume.muted()),
    togglePlayback: () => void togglePlayback(),
  });

  const applySpeed = (value: number) => {
    if (videoRef) videoRef.playbackRate = value;
    setSpeed(value);
  };

  const toggleCaptions = () => {
    const track = videoRef?.textTracks[0];
    if (!track) return;
    const next = track.mode !== "showing";
    track.mode = next ? "showing" : "hidden";
    setCaptionsOn(next);
  };

  const toggleFullscreen = () => {
    if (!wrapRef) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapRef.requestFullscreen();
  };

  onCleanup(() => {
    stopScrub?.();
    videoRef?.pause();
    videoRef?.removeAttribute("src");
    videoRef?.load();
  });

  return (
    <Show
      fallback={
        <VideoUnavailable
          class={props.class}
          href={fileSrc(props.openHref ?? props.src)}
          onRetry={() => setFailed(false)}
        />
      }
      when={!failed()}
    >
      <div
        class="video-player-wrap"
        ref={wrapRef}
        style={
          props.width && props.height && !fullscreen()
            ? mediaBoxStyle(props.width, props.height)
            : undefined
        }
      >
        <FloatingMountContext value={() => (fullscreen() ? wrapRef : undefined)}>
          <video
            aria-label={props.ariaLabel}
            class={props.class}
            onClick={() => {
              togglePlayback();
              seekRef?.focus();
            }}
            onEnded={() => setPlaying(false)}
            onError={() => setFailed(true)}
            onLoadedMetadata={(event) => {
              const value = event.currentTarget.duration;
              if (Number.isFinite(value) && value > 0) setMediaDuration(value);
            }}
            onPause={() => setPlaying(false)}
            onPlay={() => setPlaying(true)}
            onProgress={(event) => {
              const target = event.currentTarget;
              if (target.buffered.length)
                setBuffered(target.buffered.end(target.buffered.length - 1));
            }}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
            poster={imageSrc(props.poster)}
            preload={props.poster && props.duration ? "none" : "metadata"}
            ref={(element) => {
              videoRef = element;
              setVideoElement(element);
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
              icon={playing() ? "pause-filled" : "play-filled"}
              iconSize={12}
              onClick={togglePlayback}
              size="sm"
              tabIndex={-1}
            />
            <Show when={duration()}>
              <span class="video-player-time">
                {formatDuration(currentTime() > 0 ? currentTime() : duration())}
              </span>
            </Show>
          </div>

          <VideoPlayerCorner
            downloadHref={props.downloadHref ?? props.openHref}
            downloadName={props.downloadName}
            fullscreen={fullscreen()}
            onToggleFullscreen={toggleFullscreen}
            toolbarExtra={props.toolbarExtra}
            video={videoElement}
          />

          <div class="video-player-controls flex-col">
            <VideoSeekBar
              buffered={buffered()}
              currentTime={currentTime()}
              duration={duration()}
              onScrub={startScrub}
              progress={progress()}
              ref={(element) => {
                seekRef = element;
              }}
              valueText={`${formatDuration(currentTime())} of ${formatDuration(duration())}`}
            />

            <div class="video-player-controls-row flex-align-center">
              <IconButton
                class="video-player-chrome"
                hideTooltip
                icon={playing() ? "pause-filled" : "play-filled"}
                iconSize={15}
                label={playing() ? "Pause" : "Play"}
                onClick={togglePlayback}
                size="sm"
              />

              <span class="video-player-time">{formatDuration(currentTime())}</span>

              <VolumeControl
                muted={mediaVolume.muted()}
                onMutedChange={mediaVolume.setMuted}
                onVolumeChange={mediaVolume.setVolume}
                volume={mediaVolume.volume()}
              />

              <div class="video-player-row-spacer" />

              <div class="video-player-meta-group flex-align-center">
                <VideoSpeedMenu onSpeed={applySpeed} speed={speed()} />

                <Show when={props.captionsSrc}>
                  <IconButton
                    active={captionsOn()}
                    class="video-player-chrome"
                    hideTooltip
                    icon={captionsOn() ? "closed-caption-filled" : "closed-caption"}
                    iconSize={14}
                    label="Captions"
                    onClick={toggleCaptions}
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
