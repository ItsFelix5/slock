import { Icon, InlineFeedback } from "@slock/ui";
import { createSignal, For, onCleanup, Show } from "solid-js";
import { actionFeedback, endDnd, isDndActive, snoozeDnd } from "../../lib/store";
import "./DndButton.css";

const OPEN_DELAY = 350;
const CLOSE_DELAY = 200;

const DURATIONS = [
  { label: "20 minutes", minutes: 20 },
  { label: "1 hour", minutes: 60 },
  { label: "3 hours", minutes: 180 },
  { label: "8 hours", minutes: 480 },
  { label: "24 hours", minutes: 1440 },
];

// Click still does the quick default toggle (unchanged behavior). Hovering
// reveals a duration picker, but only after a delay so brushing past the
// button on the way to Settings/Search doesn't pop up a menu — same
// open/close-delay pattern as UserHoverCard, minus the portal since this
// panel is never clipped by an ancestor's overflow.
export default function DndButton() {
  const [open, setOpen] = createSignal(false);
  let openTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  const scheduleOpen = () => {
    clearTimeout(closeTimer);
    openTimer = setTimeout(() => setOpen(true), OPEN_DELAY);
  };
  const scheduleClose = () => {
    clearTimeout(openTimer);
    closeTimer = setTimeout(() => setOpen(false), CLOSE_DELAY);
  };

  onCleanup(() => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
  });

  const pick = (minutes: number) => {
    clearTimeout(openTimer);
    setOpen(false);
    snoozeDnd(minutes);
  };

  return (
    <div class="dnd-btn-wrap" onMouseEnter={scheduleOpen} onMouseLeave={scheduleClose}>
      <button
        type="button"
        class="sidebar-global-search-btn"
        classList={{ active: isDndActive() }}
        title={isDndActive() ? "Turn off Do Not Disturb" : "Turn on Do Not Disturb"}
        onClick={() => {
          clearTimeout(openTimer);
          setOpen(false);
          if (isDndActive()) endDnd();
          else snoozeDnd(60);
        }}
      >
        <Icon name={isDndActive() ? "moon-filled" : "moon"} size={16} />
      </button>
      <InlineFeedback feedback={actionFeedback.get("dnd")} class="dnd-btn-feedback" />
      <Show when={open()}>
        <div class="menu-panel dnd-duration-panel">
          <Show when={isDndActive()}>
            <button
              type="button"
              class="menu-item"
              onClick={() => {
                setOpen(false);
                endDnd();
              }}
            >
              Turn off Do Not Disturb
            </button>
            <div class="dnd-duration-divider" />
          </Show>
          <For each={DURATIONS}>
            {(d) => (
              <button type="button" class="menu-item" onClick={() => pick(d.minutes)}>
                {d.label}
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
