import { createEffect, createSignal, For, type JSX, on, onCleanup, Show } from "solid-js";
import IconButton from "../button/IconButton";
import { formatDuration } from "../formatDuration";
import Menu from "../overlay/menu/Menu";
import MenuItem from "../overlay/menu/MenuItem";
import { createMediaVolume } from "./createMediaVolume";
import Icon from "./Icon";
import "./VideoPlayer.css";
import VolumeControl from "./VolumeControl";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const pipSupported = typeof document !== "undefined" && document.pictureInPictureEnabled;

export interface VideoPlayerProps {
  ariaLabel: string;
  captionsSrc?: string;
  class?: string;
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
  const [speedOpen, setSpeedOpen] = createSignal(false);
  const [captionsOn, setCaptionsOn] = createSignal(false);

  const duration = () => mediaDuration() ?? props.duration ?? 0;
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

  const startScrub = (event: PointerEvent) => {
    const track = event.currentTarget as HTMLElement;
    seekFromPointer(event, track);
    const onMove = (moveEvent: PointerEvent) => seekFromPointer(moveEvent, track);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleSeekKeyDown = (event: KeyboardEvent) => {
    if (duration() <= 0) return;
    let nextTime: number | undefined;
    if (event.key === "ArrowLeft") nextTime = currentTime() - 5;
    if (event.key === "ArrowRight") nextTime = currentTime() + 5;
    if (event.key === "Home") nextTime = 0;
    if (event.key === "End") nextTime = duration();
    if (nextTime === undefined) return;
    event.preventDefault();
    seekTo(nextTime / duration());
  };

  const applySpeed = (value: number) => {
    if (videoRef) videoRef.playbackRate = value;
    setSpeed(value);
    setSpeedOpen(false);
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
      <div class="video-player-wrap" ref={wrapRef}>
        <video
          aria-label={props.ariaLabel}
          class={props.class}
          height={props.height}
          onClick={togglePlayback}
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
        >
          <Show when={props.captionsSrc}>
            {(src) => <track kind="captions" label="Transcript" src={src()} srclang="en" />}
          </Show>
        </video>

        <div class="video-player-idle flex-align-center">
          <IconButton
            aria-label={playing() ? "Pause" : "Play"}
            circular
            class="video-player-chrome"
            icon={playing() ? "pause-filled" : "play-filled"}
            iconSize={12}
            onClick={togglePlayback}
            size="sm"
          />
          <Show when={duration()}>
            <span class="video-player-time">{formatDuration(duration())}</span>
          </Show>
        </div>

        <div class="video-player-corner flex-align-center">
          {props.toolbarExtra}
          <a
            aria-label="Download"
            class="btn-reset icon-btn icon-action video-player-chrome sm"
            href={props.openHref}
            rel="noopener noreferrer"
            target="_blank"
          >
            <Icon name="download" size={14} />
          </a>
          <Show when={pipSupported}>
            <IconButton
              aria-label="Picture in picture"
              class="video-player-chrome"
              icon="open-in-window"
              iconSize={14}
              onClick={togglePip}
              size="sm"
            />
          </Show>
          <IconButton
            aria-label={fullscreen() ? "Exit fullscreen" : "Fullscreen"}
            class="video-player-chrome"
            icon={fullscreen() ? "reduce-diagonal" : "expand-diagonal"}
            iconSize={14}
            onClick={toggleFullscreen}
            size="sm"
          />
        </div>

        <div class="video-player-controls flex-col">
          <div
            aria-label="Seek"
            aria-valuemax={duration()}
            aria-valuemin={0}
            aria-valuenow={currentTime()}
            aria-valuetext={`${formatDuration(currentTime())} of ${formatDuration(duration())}`}
            class="video-player-seek"
            onKeyDown={handleSeekKeyDown}
            onPointerDown={startScrub}
            role="slider"
            tabIndex={0}
          >
            <div class="video-player-seek-track">
              <div
                class="video-player-seek-buffered"
                style={{
                  width: `${duration() > 0 ? Math.min(100, (buffered() / duration()) * 100) : 0}%`,
                }}
              />
              <div class="video-player-seek-played" style={{ width: `${progress() * 100}%` }} />
              <div class="video-player-seek-thumb" style={{ left: `${progress() * 100}%` }} />
            </div>
          </div>

          <div class="video-player-controls-row flex-align-center">
            <IconButton
              aria-label={playing() ? "Pause" : "Play"}
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
              <Menu
                onClose={() => setSpeedOpen(false)}
                open={speedOpen()}
                panelClass="menu-panel video-player-speed-panel"
                trigger={
                  <button
                    class="video-player-speed video-player-chrome btn-reset flex-align-center"
                    onClick={() => setSpeedOpen(!speedOpen())}
                    type="button"
                  >
                    {speed()}x
                    <Icon name="caret-down" size={9} />
                  </button>
                }
              >
                <For each={SPEEDS}>
                  {(value) => (
                    <MenuItem
                      classList={{ active: speed() === value }}
                      onClick={() => applySpeed(value)}
                    >
                      {value}x
                    </MenuItem>
                  )}
                </For>
              </Menu>

              <Show when={props.captionsSrc}>
                <IconButton
                  active={captionsOn()}
                  aria-label={captionsOn() ? "Hide captions" : "Show captions"}
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
