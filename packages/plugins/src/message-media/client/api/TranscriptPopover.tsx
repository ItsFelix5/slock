import { formatDuration } from "@slock/blockkit";
import { createFileDetailQuery } from "@slock/plugins/files/client/api/fileDetailQuery";
import { isWaiting } from "@slock/resource";
import type { SlackFile } from "@slock/types";
import { IconButton, Popover } from "@slock/ui";
import { createEffect, createSignal, For, Match, Switch } from "solid-js";
import "./TranscriptPopover.css";

export default function TranscriptPopover(props: {
  file: SlackFile;
  media: () => HTMLMediaElement | undefined;
  triggerClass?: string;
}) {
  const [open, setOpen] = createSignal(false);
  const [currentTime, setCurrentTime] = createSignal(0);
  let bodyRef: HTMLDivElement | undefined;

  createEffect(
    () => ({ media: props.media(), listening: open() }),
    ({ media, listening }) => {
      if (!(media && listening)) return;
      setCurrentTime(media.currentTime);
      const onTimeUpdate = () => setCurrentTime(media.currentTime);
      media.addEventListener("timeupdate", onTimeUpdate);
      return () => media.removeEventListener("timeupdate", onTimeUpdate);
    },
  );

  const detail = createFileDetailQuery(() =>
    open() && !props.file.transcriptionLines ? props.file.id : undefined,
  );

  const lines = () => detail().data?.file.transcriptionLines ?? props.file.transcriptionLines ?? [];

  const seek = (startMs: number) => {
    const media = props.media();
    if (!media) return;
    media.currentTime = startMs / 1000;
    void media.play();
  };

  createEffect(
    () => ({ time: currentTime(), visible: open() }),
    ({ visible }) => {
      if (!visible) return;
      bodyRef
        ?.querySelector<HTMLElement>('[data-active="true"]')
        ?.scrollIntoView({ block: "nearest" });
    },
  );

  return (
    <Popover
      onClose={() => setOpen(false)}
      open={open()}
      panelClass="transcript-popover-panel"
      trigger={
        <IconButton
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
          <Match when={isWaiting(detail()) && lines().length === 0}>
            <div class="transcript-popover-status text-dim text-xs">Loading transcript…</div>
          </Match>
          <Match when={lines().length}>
            <For each={lines()}>
              {(line) => {
                const active = () =>
                  currentTime() * 1000 >= line.startMs && currentTime() * 1000 < line.endMs;
                return (
                  <button
                    class={["btn-reset transcript-line", { active: active() }]}
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
          <Match when={!isWaiting(detail())}>
            <div class="transcript-popover-status text-dim text-xs">No transcript available.</div>
          </Match>
        </Switch>
      </div>
    </Popover>
  );
}
