import Icon from "./Icon";
import "./VolumeControl.css";

export interface VolumeControlProps {
  muted: boolean;
  onMutedChange: (muted: boolean) => void;
  onVolumeChange: (volume: number) => void;
  volume: number;
}

export default function VolumeControl(props: VolumeControlProps) {
  const currentVolume = () => (props.muted ? 0 : props.volume);
  const percentage = () => Math.round(currentVolume() * 100);
  const trackBackground = () => {
    const volume = currentVolume();
    const volumeEnd = volume * 20;
    return `linear-gradient(to top, var(--accent) 0 ${volumeEnd}%, var(--border-strong) ${volumeEnd}% 100%)`;
  };
  const icon = () => {
    const volume = currentVolume();
    if (volume === 0) return "sound-off";
    if (volume < 0.34) return "sound-down";
    if (volume < 0.67) return "sound-medium";
    return "sound-up";
  };

  const toggleMuted = () => {
    const nextMuted = !props.muted;
    if (!nextMuted && props.volume === 0) props.onVolumeChange(1);
    props.onMutedChange(nextMuted);
  };

  return (
    <div class="volume-control">
      <button
        aria-label={props.muted ? "Unmute" : "Mute"}
        class="volume-control-toggle btn-reset flex-align-center"
        onClick={toggleMuted}
        type="button"
      >
        <Icon name={icon()} size={16} />
      </button>
      <div class="volume-control-panel">
        <output class="volume-control-value">{percentage()}%</output>
        <div class="volume-control-slider">
          <input
            aria-label="Volume"
            aria-valuetext={`${percentage()}%${currentVolume() > 1 ? " boost" : ""}`}
            class="volume-control-input"
            max="5"
            min="0"
            onInput={(event) => {
              const volume = event.currentTarget.valueAsNumber;
              props.onVolumeChange(volume);
              props.onMutedChange(volume === 0);
            }}
            step="0.05"
            style={{ background: trackBackground() }}
            type="range"
            value={currentVolume()}
          />
        </div>
      </div>
    </div>
  );
}
