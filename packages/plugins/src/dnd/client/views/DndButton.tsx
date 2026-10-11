import { service } from "@slock/core/solid";
import { FloatingPanel, IconButton, InlineFeedback, MenuItem } from "@slock/ui";
import { createSignal, For, onCleanup } from "solid-js";
import "./DndButton.css";

const feedback = service("feedback");

const prefsStore = service("prefs");

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
    if (!(prefsStore.isDndActive() || prefsStore.hasDndStatusError()))
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
    if (prefsStore.isDndPending()) return;
    clearTimeout(openTimer);
    setOpen(false);
    prefsStore.snoozeDnd(minutes);
  };

  return (
    <fieldset
      aria-busy={prefsStore.isDndPending()}
      class="dnd-btn-wrap"
      disabled={prefsStore.isDndPending()}
      onBlur={scheduleClose}
      onFocus={scheduleOpen}
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
      ref={wrapRef}
    >
      <IconButton
        class="sidebar-global-search-btn icon-shift"
        disabled={prefsStore.isDndPending()}
        icon={prefsStore.isDndActive() ? "moon-filled" : "moon"}
        label={
          prefsStore.hasDndStatusError()
            ? "Retry Do Not Disturb status"
            : prefsStore.isDndActive()
              ? "Turn off Do Not Disturb"
              : undefined
        }
        onClick={() => {
          clearTimeout(openTimer);
          setOpen(false);
          if (prefsStore.hasDndStatusError()) prefsStore.retryDndStatus();
          else if (prefsStore.isDndActive()) prefsStore.endDnd();
          else prefsStore.snoozeDnd(60);
        }}
      />
      <InlineFeedback class="dnd-btn-feedback" feedback={feedback.get("dnd")} />
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
