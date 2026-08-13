import { FloatingPanel, IconButton, InlineFeedback, MenuItem } from "@slock/ui";
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

export default function DndButton() {
  const [open, setOpen] = createSignal(false);

  let wrapRef: HTMLFieldSetElement | undefined;
  let openTimer: ReturnType<typeof setTimeout> | undefined;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;

  const scheduleOpen = () => {
    clearTimeout(closeTimer);
    if (!(store.preferences.isDndActive() || store.preferences.hasDndStatusError()))
      openTimer = setTimeout(() => setOpen(true), OPEN_DELAY);
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
    if (store.preferences.isDndPending()) return;
    clearTimeout(openTimer);
    setOpen(false);
    store.preferences.snoozeDnd(minutes);
  };

  return (
    <fieldset
      aria-busy={store.preferences.isDndPending()}
      class="dnd-btn-wrap"
      disabled={store.preferences.isDndPending()}
      onBlur={scheduleClose}
      onFocus={scheduleOpen}
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
      ref={wrapRef}
    >
      <IconButton
        class="sidebar-global-search-btn"
        disabled={store.preferences.isDndPending()}
        icon={store.preferences.isDndActive() ? "moon-filled" : "moon"}
        label={
          store.preferences.hasDndStatusError()
            ? "Retry Do Not Disturb status"
            : store.preferences.isDndActive()
              ? "Turn off Do Not Disturb"
              : "Turn on Do Not Disturb"
        }
        onClick={() => {
          clearTimeout(openTimer);
          setOpen(false);
          if (store.preferences.hasDndStatusError()) store.preferences.retryDndStatus();
          else if (store.preferences.isDndActive()) store.preferences.endDnd();
          else store.preferences.snoozeDnd(60);
        }}
      />
      <InlineFeedback class="dnd-btn-feedback" feedback={actionFeedback.get("dnd")} />
      <FloatingPanel
        anchor={() => wrapRef}
        class="menu-panel dnd-duration-panel"
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        onScroll={() => setOpen(false)}
        open={open()}
      >
        <For each={DURATIONS}>
          {(d) => <MenuItem onClick={() => pick(d.minutes)}>{d.label}</MenuItem>}
        </For>
      </FloatingPanel>
    </fieldset>
  );
}
