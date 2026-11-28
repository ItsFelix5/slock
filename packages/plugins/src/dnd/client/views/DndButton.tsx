import { service } from "@slock/core/solid";
import { FloatingPanel, IconButton, InlineFeedback, MenuItem, useHoverIntent } from "@slock/ui";
import { For } from "solid-js";
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
  const hover = useHoverIntent(OPEN_DELAY, CLOSE_DELAY);
  let wrapRef: HTMLFieldSetElement | undefined;

  const scheduleOpen = () => {
    if (prefsStore.isDndActive() || prefsStore.hasDndStatusError()) hover.cancelClose();
    else hover.scheduleOpen();
  };

  const pick = (minutes: number) => {
    if (prefsStore.isDndPending()) return;
    hover.close();
    prefsStore.snoozeDnd(minutes);
  };

  return (
    <fieldset
      aria-busy={prefsStore.isDndPending() ? "true" : "false"}
      class="dnd-btn-wrap"
      disabled={prefsStore.isDndPending()}
      onBlur={hover.scheduleClose}
      onFocus={scheduleOpen}
      onMouseEnter={scheduleOpen}
      onMouseLeave={hover.scheduleClose}
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
          hover.close();
          if (prefsStore.hasDndStatusError()) prefsStore.retryDndStatus();
          else if (prefsStore.isDndActive()) prefsStore.endDnd();
          else prefsStore.snoozeDnd(60);
        }}
      />
      <InlineFeedback class="dnd-btn-feedback" feedback={feedback.get("dnd")} />
      <FloatingPanel
        anchor={() => wrapRef}
        class="menu-panel dnd-duration-panel"
        onMouseEnter={hover.cancelClose}
        onMouseLeave={hover.scheduleClose}
        onScroll={hover.close}
        open={hover.open()}
      >
        <For each={DURATIONS}>
          {(d) => <MenuItem onClick={() => pick(d.minutes)}>{d.label}</MenuItem>}
        </For>
      </FloatingPanel>
    </fieldset>
  );
}
