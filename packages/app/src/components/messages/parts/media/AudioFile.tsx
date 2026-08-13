import { formatDuration } from "@slock/blockkit";
import { resolveMediaUrl, type SlackFile } from "@slock/slack-api";
import { createMediaVolume, Icon, VolumeControl } from "@slock/ui";
import { createSignal, For, onCleanup, Show } from "solid-js";
import "./AudioFile.css";

const BAR_COUNT = 40;

function resample(raw: number[]): number[] {
  if (raw.length <= BAR_COUNT) return raw;
  const bars: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    const start = Math.floor((i * raw.length) / BAR_COUNT);
    const end = Math.max(start + 1, Math.floor(((i + 1) * raw.length) / BAR_COUNT));
    const chunk = raw.slice(start, end);
    bars.push(chunk.reduce((sum, v) => sum + v, 0) / chunk.length);
  }
  return bars;
}

export default function AudioFile(props: { file: SlackFile }) {
  let audioRef: HTMLAudioElement | undefined;
  const [audioElement, setAudioElement] = createSignal<HTMLAudioElement>();
  const mediaVolume = createMediaVolume(audioElement);
  const [playing, setPlaying] = createSignal(false);
  const [currentTime, setCurrentTime] = createSignal(0);
  const [mediaDuration, setMediaDuration] = createSignal<number>();
  const [loadError, setLoadError] = createSignal(false);
  const samples = () => {
    const waveform = resample(props.file.waveform ?? []);
    return waveform.length > 0 ? waveform : Array.from({ length: BAR_COUNT }, () => 16);
  };
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

  onCleanup(() => {
    audioRef?.pause();
    audioRef?.removeAttribute("src");
    audioRef?.load();
  });

  return (
    <div class="audio-file">
      <Show
        fallback={
          <div class="audio-file-error">
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
            <a
              class="audio-file-action"
              href={props.file.urlPrivate}
              rel="noopener noreferrer"
              target="_blank"
            >
              Open audio
            </a>
          </div>
        }
        when={!loadError()}
      >
        <div class="audio-file-controls flex-align-center">
          <button
            aria-label={playing() ? "Pause" : "Play"}
            class="audio-file-play btn-reset flex-align-center"
            onClick={togglePlayback}
            type="button"
          >
            <Icon name={playing() ? "pause-filled" : "play-filled"} size={16} />
          </button>
          <div
            aria-disabled={duration() <= 0}
            aria-label={`Playback position for ${props.file.title || props.file.name}`}
            aria-valuemax={duration()}
            aria-valuemin={0}
            aria-valuenow={currentTime()}
            aria-valuetext={`${formatDuration(currentTime())} of ${formatDuration(duration())}`}
            class="audio-file-waveform"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              seekTo((event.clientX - rect.left) / rect.width);
            }}
            onKeyDown={handleSeekKeyDown}
            tabIndex={0}
          >
            <For each={samples()}>
              {(sample, index) => (
                <div
                  class="audio-file-bar"
                  classList={{ played: (index() + 1) / samples().length <= progress() }}
                  style={{ height: `${Math.min(100, Math.max(Number(sample) || 0, 8))}%` }}
                />
              )}
            </For>
          </div>
          <span class="audio-file-duration text-dim text-xs">
            {formatDuration(playing() || currentTime() ? currentTime() : duration())}
          </span>
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
        preload="metadata"
        ref={(audio) => {
          audioRef = audio;
          setAudioElement(audio);
        }}
        src={resolveMediaUrl(props.file.urlPrivate)}
      />
      <Show when={props.file.transcriptionPreview}>
        {(text) => (
          <div class="audio-file-transcript text-dim text-xs">
            {text()}
            {props.file.transcriptionHasMore ? "…" : ""}
          </div>
        )}
      </Show>
    </div>
  );
}
