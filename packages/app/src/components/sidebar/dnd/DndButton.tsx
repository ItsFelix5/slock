import { FloatingPanel, Icon, InlineFeedback, Tooltip } from "@slock/ui";
import { createSignal, For, onCleanup } from "solid-js";
import { actionFeedback, store } from "../../../lib/store";
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
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this variable through the JSX ref attribute.
  let wrapRef: HTMLFieldSetElement | undefined;
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
  const cancelClose = () => clearTimeout(closeTimer);

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
      ref={wrapRef}
    >
      <Tooltip
        content={
          store.preferences.isDndActive() ? "Turn off Do Not Disturb" : "Turn on Do Not Disturb"
        }
      >
        <button
          aria-label={
            store.preferences.isDndActive() ? "Turn off Do Not Disturb" : "Turn on Do Not Disturb"
          }
          class="sidebar-global-search-btn btn-reset icon-btn icon-action"
          onClick={() => {
            clearTimeout(openTimer);
            setOpen(false);
            if (store.preferences.isDndActive()) store.preferences.endDnd();
            else store.preferences.snoozeDnd(60);
          }}
          type="button"
        >
          <Icon name={store.preferences.isDndActive() ? "moon-filled" : "moon"} size={16} />
        </button>
      </Tooltip>
      <InlineFeedback class="dnd-btn-feedback" feedback={actionFeedback.get("dnd")} />
      <FloatingPanel
        anchor={() => wrapRef}
        class="menu-panel dnd-duration-panel"
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        open={open()}
      >
        <For each={DURATIONS}>
          {(d) => (
            <button class="menu-item" onClick={() => pick(d.minutes)} type="button">
              {d.label}
            </button>
          )}
        </For>
      </FloatingPanel>
    </fieldset>
  );
}
