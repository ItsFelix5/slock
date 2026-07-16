import { fileProxyUrl, type SlackFile } from "@slock/slack-api";
import { Icon } from "@slock/ui";
import { createSignal, For, Show } from "solid-js";
import "./AudioFile.css";

function formatDuration(seconds: number | undefined): string {
  const total = Math.max(0, Math.round(seconds ?? 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// Slack ships one raw sample per ~0.4s of audio, so a longer message can carry
// hundreds of values — far more than fit as individually visible bars. Fold
// them down to a fixed count so the waveform's width never depends on clip length.
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
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this variable through the JSX ref attribute.
  let audioRef: HTMLAudioElement | undefined;
  const [playing, setPlaying] = createSignal(false);
  const [currentTime, setCurrentTime] = createSignal(0);
  const samples = () => resample(props.file.waveform ?? []);
  const progress = () => (props.file.duration ? currentTime() / props.file.duration : 0);

  const seekTo = (ratio: number) => {
    if (audioRef && props.file.duration) audioRef.currentTime = ratio * props.file.duration;
  };

  return (
    <div class="audio-file">
      <div class="audio-file-controls flex-align-center">
        <button
          aria-label={playing() ? "Pause" : "Play"}
          class="audio-file-play btn-reset flex-align-center"
          onClick={() => (playing() ? audioRef?.pause() : audioRef?.play())}
          type="button"
        >
          <Icon name={playing() ? "pause-filled" : "play-filled"} size={16} />
        </button>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: seeking by click is a mouse-only convenience alongside native audio controls */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: see above */}
        <div
          class="audio-file-waveform"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            seekTo((e.clientX - rect.left) / rect.width);
          }}
        >
          <For each={samples()}>
            {(sample, i) => (
              <div
                class="audio-file-bar"
                classList={{ played: i() / samples().length <= progress() }}
                style={{ height: `${Math.max(sample, 8)}%` }}
              />
            )}
          </For>
        </div>
        <span class="audio-file-duration text-dim text-xs">
          {formatDuration(playing() || currentTime() ? currentTime() : props.file.duration)}
        </span>
      </div>
      <audio
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        preload="metadata"
        ref={audioRef}
        src={fileProxyUrl(props.file.urlPrivate)}
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
