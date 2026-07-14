import { Icon, InlineFeedback } from "@slock/ui";
import { createSignal, For, onCleanup, Show } from "solid-js";
import { actionFeedback, store } from "../../lib/store";
import "./DndButton.css";

const OPEN_DELAY = 350;
const CLOSE_DELAY = 200;

const DURATIONS = [
  { label: "20m", minutes: 20 },
  { label: "1h", minutes: 60 },
  { label: "3h", minutes: 180 },
  { label: "8h", minutes: 480 },
  { label: "24h", minutes: 1440 },
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
    if (!store.preferences.isDndActive()) openTimer = setTimeout(() => setOpen(true), OPEN_DELAY);
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
    store.preferences.snoozeDnd(minutes);
  };

  return (
    <fieldset
      class="dnd-btn-wrap"
      onBlur={scheduleClose}
      onFocus={scheduleOpen}
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
    >
      <button
        class="sidebar-global-search-btn btn-reset icon-btn icon-action"
        onClick={() => {
          clearTimeout(openTimer);
          setOpen(false);
          if (store.preferences.isDndActive()) store.preferences.endDnd();
          else store.preferences.snoozeDnd(60);
        }}
        title={
          store.preferences.isDndActive() ? "Turn off Do Not Disturb" : "Turn on Do Not Disturb"
        }
        type="button"
      >
        <Icon name={store.preferences.isDndActive() ? "moon-filled" : "moon"} size={16} />
      </button>
      <InlineFeedback class="dnd-btn-feedback" feedback={actionFeedback.get("dnd")} />
      <Show when={open()}>
        <div class="menu-panel dnd-duration-panel">
          <For each={DURATIONS}>
            {(d) => (
              <button class="menu-item" onClick={() => pick(d.minutes)} type="button">
                {d.label}
              </button>
            )}
          </For>
        </div>
      </Show>
    </fieldset>
  );
}
