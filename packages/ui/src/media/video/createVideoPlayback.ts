import { createEffect, createSignal, onCleanup, onSettled } from "solid-js";
import { startFrameCoalescedPointerDrag } from "../../pointerDrag";
import { createMediaVolume } from "./createMediaVolume";
import { useVideoShortcuts } from "./useVideoShortcuts";
import { ratioFromPointer, ratioOf, timeFromRatio } from "./videoTime";

export function createVideoPlayback(options: {
  duration: () => number | undefined;
  src: () => string;
}) {
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

  const duration = () => options.duration() ?? mediaDuration() ?? 0;
  const progress = () => ratioOf(currentTime(), duration());

  createEffect(
    options.src,
    () => {
      setFailed(false);
      setPlaying(false);
      setCurrentTime(0);
    },
    { defer: true },
  );

  onSettled(() => {
    const onFullscreenChange = () => setFullscreen(document.fullscreenElement === wrapRef);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  });

  const playOrPause = async () => {
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
  const togglePlayback = () => {
    void playOrPause();
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

  const toggleFullscreen = () => {
    if (!wrapRef) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapRef.requestFullscreen();
  };

  useVideoShortcuts({
    currentTime,
    duration,
    root: () => wrapRef,
    seekRoot: () => seekRef,
    seekTo,
    toggleFullscreen,
    toggleMute: () => mediaVolume.setMuted(!mediaVolume.muted()),
    togglePlayback,
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

  onCleanup(() => {
    stopScrub?.();
    videoRef?.pause();
    videoRef?.removeAttribute("src");
    videoRef?.load();
  });

  return {
    applySpeed,
    buffered,
    captionsOn,
    currentTime,
    duration,
    failed,
    focusSeek: () => seekRef?.focus(),
    fullscreen,
    mediaVolume,
    playing,
    progress,
    retry: () => setFailed(false),
    setSeekRef: (element: HTMLDivElement) => {
      seekRef = element;
    },
    setVideoRef: (element: HTMLVideoElement) => {
      videoRef = element;
      setVideoElement(element);
    },
    setWrapRef: (element: HTMLDivElement) => {
      wrapRef = element;
    },
    speed,
    startScrub,
    toggleCaptions,
    toggleFullscreen,
    togglePlayback,
    video: videoElement,
    wrapElement: () => wrapRef,
    videoEvents: {
      onEnded: () => setPlaying(false),
      onError: () => setFailed(true),
      onLoadedMetadata: (event: Event & { currentTarget: HTMLVideoElement }) => {
        const value = event.currentTarget.duration;
        if (Number.isFinite(value) && value > 0) setMediaDuration(value);
      },
      onPause: () => setPlaying(false),
      onPlay: () => setPlaying(true),
      onProgress: (event: Event & { currentTarget: HTMLVideoElement }) => {
        const target = event.currentTarget;
        if (target.buffered.length) setBuffered(target.buffered.end(target.buffered.length - 1));
      },
      onTimeUpdate: (event: Event & { currentTarget: HTMLVideoElement }) =>
        setCurrentTime(event.currentTarget.currentTime),
    },
  };
}
