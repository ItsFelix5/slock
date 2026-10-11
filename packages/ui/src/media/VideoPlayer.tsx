import { createEffect, createSignal, type JSX, on, onCleanup, Show } from "solid-js";
import IconButton from "../button/IconButton";
import { startFrameCoalescedPointerDrag } from "../pointerDrag";
import { createMediaVolume } from "./createMediaVolume";
import Icon from "./Icon";
import "./VideoPlayer.css";
import { useVideoShortcuts } from "./useVideoShortcuts";
import VideoSeekBar from "./VideoSeekBar";
import VideoSpeedMenu from "./VideoSpeedMenu";
import VideoUnavailable from "./VideoUnavailable";
import VolumeControl from "./VolumeControl";

export function formatDuration(seconds: number | undefined): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds ?? 0)) : 0;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

const pipSupported = typeof document !== "undefined" && document.pictureInPictureEnabled;

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
  const progress = () =>
    duration() > 0 ? Math.min(1, Math.max(0, currentTime() / duration())) : 0;

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
    if (!videoRef || duration() <= 0) return;
    const nextTime = Math.min(1, Math.max(0, ratio)) * duration();
    videoRef.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const seekFromPointer = (event: PointerEvent, track: HTMLElement) => {
    const rect = track.getBoundingClientRect();
    seekTo((event.clientX - rect.left) / rect.width);
  };

  const startScrub = (event: PointerEvent & { currentTarget: HTMLElement }) => {
    const track = event.currentTarget;
    seekFromPointer(event, track);
    startFrameCoalescedPointerDrag((moveEvent) => seekFromPointer(moveEvent, track));
  };

  useVideoShortcuts({
    currentTime,
    duration,
    root: () => wrapRef,
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

  const togglePip = async () => {
    if (!videoRef) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await videoRef.requestPictureInPicture();
    } catch {}
  };

  const toggleFullscreen = () => {
    if (!wrapRef) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapRef.requestFullscreen();
  };

  onCleanup(() => {
    videoRef?.pause();
    videoRef?.removeAttribute("src");
    videoRef?.load();
  });

  return (
    <Show
      fallback={
        <VideoUnavailable
          class={props.class}
          href={props.openHref ?? props.src}
          onRetry={() => setFailed(false)}
        />
      }
      when={!failed()}
    >
      <div class="video-player-wrap" ref={wrapRef} tabIndex={-1}>
        <video
          aria-label={props.ariaLabel}
          class={props.class}
          height={props.height}
          width={props.width}
          onClick={() => {
            togglePlayback();
            wrapRef?.focus();
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
          poster={props.poster}
          preload="metadata"
          ref={(element) => {
            videoRef = element;
            setVideoElement(element);
            props.ref?.(element);
          }}
          src={props.src}
          style={
            props.width && props.height && !fullscreen()
              ? {
                  "aspect-ratio": `${props.width} / ${props.height}`,
                  width: `min(${props.width}px, 100%)`,
                }
              : undefined
          }
        >
          <Show when={props.captionsSrc}>
            {(src) => <track kind="captions" label="Transcript" src={src()} srclang="en" />}
          </Show>
        </video>

        <div class="video-player-idle flex-align-center">
          <IconButton
            circular
            class="video-player-chrome"
            icon={playing() ? "pause-filled" : "play-filled"}
            iconSize={12}
            onClick={togglePlayback}
            size="sm"
          />
          <Show when={duration()}>
            <span class="video-player-time">
              {formatDuration(currentTime() > 0 ? currentTime() : duration())}
            </span>
          </Show>
        </div>

        <div class="video-player-corner flex-align-center">
          {props.toolbarExtra}
          <a
            aria-label="Download"
            class="btn-reset icon-btn icon-action video-player-chrome sm"
            download={props.downloadName ?? ""}
            href={props.downloadHref ?? props.openHref}
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
            icon={fullscreen() ? "reduce-diagonal" : "expand-diagonal"}
            iconSize={14}
            onClick={toggleFullscreen}
            size="sm"
          />
        </div>

        <div class="video-player-controls flex-col">
          <VideoSeekBar
            buffered={buffered()}
            currentTime={currentTime()}
            duration={duration()}
            onScrub={startScrub}
            progress={progress()}
            valueText={`${formatDuration(currentTime())} of ${formatDuration(duration())}`}
          />

          <div class="video-player-controls-row flex-align-center">
            <IconButton
              class="video-player-chrome"
              icon={playing() ? "pause-filled" : "play-filled"}
              iconSize={15}
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
                  icon={captionsOn() ? "closed-caption-filled" : "closed-caption"}
                  iconSize={14}
                  onClick={toggleCaptions}
                  size="sm"
                />
              </Show>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
