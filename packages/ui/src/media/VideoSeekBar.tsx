export default function VideoSeekBar(props: {
  buffered: number;
  currentTime: number;
  duration: number;
  onScrub: (event: PointerEvent & { currentTarget: HTMLElement }) => void;
  progress: number;
  valueText: string;
}) {
  return (
    <div
      aria-label="Seek"
      aria-valuemax={props.duration}
      aria-valuemin={0}
      aria-valuenow={props.currentTime}
      aria-valuetext={props.valueText}
      class="video-player-seek"
      onPointerDown={props.onScrub}
      role="slider"
      tabIndex={0}
    >
      <div class="video-player-seek-track">
        <div
          class="video-player-seek-buffered"
          style={{
            width: `${props.duration > 0 ? Math.min(100, (props.buffered / props.duration) * 100) : 0}%`,
          }}
        />
        <div class="video-player-seek-played" style={{ width: `${props.progress * 100}%` }} />
        <div class="video-player-seek-thumb" style={{ left: `${props.progress * 100}%` }} />
      </div>
    </div>
  );
}
