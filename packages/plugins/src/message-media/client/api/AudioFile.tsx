import { formatDuration, safeMediaUrl } from "@slock/blockkit";
import type { SlackFile } from "@slock/types";
import {
  ContextMenu,
  createMediaVolume,
  Icon,
  IconButton,
  isThirdParty,
  MenuItem,
  useContextMenu,
  useSeekShortcuts,
  VolumeControl,
} from "@slock/ui";
import { createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { BAR_COUNT, downloadName, resample } from "./audioFileData";
import "./AudioFile.css";
import TranscriptPopover from "./TranscriptPopover";

export default function AudioFile(props: { file: SlackFile }) {
  let audioRef: HTMLAudioElement | undefined;
  let waveformRef: HTMLDivElement | undefined;
  const [audioElement, setAudioElement] = createSignal<HTMLAudioElement>();
  const mediaVolume = createMediaVolume(audioElement);
  const [playing, setPlaying] = createSignal(false);
  const [currentTime, setCurrentTime] = createSignal(0);
  const [mediaDuration, setMediaDuration] = createSignal<number>();
  const [loadError, setLoadError] = createSignal(false);
  const ctxMenu = useContextMenu();

  const download = () => {
    const link = document.createElement("a");
    const href = safeMediaUrl(props.file.urlPrivateDownload ?? props.file.urlPrivate);
    if (!href) return;
    link.href = href;
    link.download = downloadName(props.file);
    link.rel = "noopener noreferrer";
    link.click();
  };

  const copyLink = () => {
    if (props.file.permalink) void navigator.clipboard.writeText(props.file.permalink);
  };
  const samples = createMemo(() => {
    const waveform = resample(props.file.waveform ?? []);
    return waveform.length > 0 ? waveform : Array.from({ length: BAR_COUNT }, () => 16);
  });
  const duration = () => mediaDuration() ?? props.file.duration ?? 0;
  const progress = () =>
    duration() > 0 ? Math.min(1, Math.max(0, currentTime() / duration())) : 0;

  const seekTo = (ratio: number) => {
    if (!audioRef || duration() <= 0) return;
    const nextTime = Math.min(1, Math.max(0, ratio)) * duration();
    audioRef.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const togglePlayback = async () => {
    if (!audioRef) return;
    if (!audioRef.paused) {
      audioRef.pause();
      return;
    }
    try {
      await audioRef.play();
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setLoadError(true);
    }
  };

  const updateDuration = (audio: HTMLAudioElement) => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) setMediaDuration(audio.duration);
  };

  useSeekShortcuts({ currentTime, duration, root: () => waveformRef, seekTo });

  onCleanup(() => {
    audioRef?.pause();
    audioRef?.removeAttribute("src");
    audioRef?.load();
  });

  return (
    <div
      class="audio-file"
      onContextMenu={ctxMenu.open}
      title={props.file.title || props.file.name}
    >
      <Show
        fallback={
          <div class="audio-file-error flex-align-center gap-sm">
            <Icon name="warning" size={18} />
            <span>Audio unavailable.</span>
            <button
              class="audio-file-action btn-reset"
              onClick={() => {
                setLoadError(false);
                audioRef?.load();
              }}
              type="button"
            >
              Try again
            </button>
          </div>
        }
        when={!loadError()}
      >
        <div class="audio-file-controls flex-align-center">
          <IconButton
            class="audio-file-play"
            icon={playing() ? "pause-filled" : "play-filled"}
            label={playing() ? "Pause" : "Play"}
            onClick={togglePlayback}
          />
          <div
            class={["audio-file-waveform", { disabled: duration() <= 0 }]}
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              seekTo((event.clientX - rect.left) / rect.width);
            }}
            ref={waveformRef}
            tabindex={0}
          >
            <For each={samples()}>
              {(sample, index) => (
                <div
                  class={[
                    "audio-file-bar",
                    { played: (index() + 1) / samples().length <= progress() },
                  ]}
                  style={{ height: `${Math.min(100, Math.max(Number(sample) || 0, 8))}%` }}
                />
              )}
            </For>
          </div>
          <span class="audio-file-duration text-dim text-xs">
            {formatDuration(playing() || currentTime() ? currentTime() : duration())}
          </span>
          <Show when={props.file.transcriptionPreview}>
            <TranscriptPopover file={props.file} media={audioElement} />
          </Show>
          <VolumeControl
            muted={mediaVolume.muted()}
            onMutedChange={mediaVolume.setMuted}
            onVolumeChange={mediaVolume.setVolume}
            volume={mediaVolume.volume()}
          />
        </div>
      </Show>
      <audio
        onEnded={() => setPlaying(false)}
        onError={() => setLoadError(true)}
        onLoadedMetadata={(event) => updateDuration(event.currentTarget)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        preload={isThirdParty(props.file.urlPrivate) ? "none" : "metadata"}
        ref={(audio) => {
          audioRef = audio;
          setAudioElement(audio);
        }}
        src={safeMediaUrl(props.file.urlPrivate)}
      />
      <ContextMenu onClose={ctxMenu.close} open={ctxMenu.isOpen()} x={ctxMenu.x()} y={ctxMenu.y()}>
        <MenuItem
          icon="download"
          onClick={() => {
            ctxMenu.close();
            download();
          }}
        >
          Download
        </MenuItem>
        <Show when={props.file.permalink}>
          <MenuItem
            icon="link"
            onClick={() => {
              ctxMenu.close();
              copyLink();
            }}
          >
            Copy link
          </MenuItem>
        </Show>
      </ContextMenu>
    </div>
  );
}
