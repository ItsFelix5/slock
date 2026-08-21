import { formatDuration } from "@slock/blockkit";
import { IconButton, Popover } from "@slock/ui";
import {
  createEffect,
  createResource,
  createSignal,
  For,
  Match,
  onCleanup,
  Switch,
} from "solid-js";
import { fetchFileDetail, type SlackFile } from "../../../../lib/api";
import "./TranscriptPopover.css";

export default function TranscriptPopover(props: {
  file: SlackFile;
  media: () => HTMLMediaElement | undefined;
  triggerClass?: string;
}) {
  const [open, setOpen] = createSignal(false);
  const [currentTime, setCurrentTime] = createSignal(0);
  let bodyRef: HTMLDivElement | undefined;

  createEffect(() => {
    const media = props.media();
    if (!(media && open())) return;
    const onTimeUpdate = () => setCurrentTime(media.currentTime);
    media.addEventListener("timeupdate", onTimeUpdate);
    onCleanup(() => media.removeEventListener("timeupdate", onTimeUpdate));
  });

  const [detail] = createResource(
    () => (open() && !props.file.transcriptionLines ? props.file.id : undefined),
    fetchFileDetail,
  );

  const lines = () => detail()?.file.transcriptionLines ?? props.file.transcriptionLines ?? [];

  const seek = (startMs: number) => {
    const media = props.media();
    if (!media) return;
    media.currentTime = startMs / 1000;
    void media.play();
  };

  createEffect(() => {
    currentTime();
    if (!open()) return;
    bodyRef
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  });

  return (
    <Popover
      onClose={() => setOpen(false)}
      open={open()}
      panelClass="transcript-popover-panel"
      trigger={
        <IconButton
          aria-label="Show transcript"
          class={props.triggerClass}
          icon="transcript"
          iconSize={14}
          onClick={() => setOpen(!open())}
          size="sm"
        />
      }
    >
      <div class="transcript-popover-body" ref={bodyRef}>
        <Switch>
          <Match when={detail.loading && lines().length === 0}>
            <div class="transcript-popover-status text-dim text-xs">Loading transcript…</div>
          </Match>
          <Match when={lines().length}>
            <For each={lines()}>
              {(line) => {
                const active = () =>
                  currentTime() * 1000 >= line.startMs && currentTime() * 1000 < line.endMs;
                return (
                  <button
                    class="btn-reset"
                    classList={{ "transcript-line": true, active: active() }}
                    data-active={active() ? "true" : undefined}
                    onClick={() => seek(line.startMs)}
                    type="button"
                  >
                    <span class="transcript-line-time text-dim">
                      {formatDuration(line.startMs / 1000)}
                    </span>
                    <span class="transcript-line-text">{line.text}</span>
                  </button>
                );
              }}
            </For>
          </Match>
          <Match when={!detail.loading}>
            <div class="transcript-popover-status text-dim text-xs">No transcript available.</div>
          </Match>
        </Switch>
      </div>
    </Popover>
  );
}
