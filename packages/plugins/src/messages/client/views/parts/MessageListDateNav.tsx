import { Icon, Popover } from "@slock/ui";
import { createSignal } from "solid-js";
import "./MessageListDateNav.css";
import { defined, startOfDay, toLocalInputValue } from "@slock/core";
import { service } from "@slock/core/solid";

const env = service("env");

export default function MessageListDateNav(props: {
  day: string;
  onJumpToDate: (dateMs: number) => void;
  onJumpToBeginning: () => void;
}) {
  const [open, setOpen] = createSignal(false);
  const close = () => setOpen(false);

  const jumpToDate = (dateMs: number) => {
    props.onJumpToDate(dateMs);
    close();
  };

  return (
    <Popover
      align="center"
      class="message-list-date-nav"
      onClose={close}
      open={open()}
      panelClass="message-list-date-nav-panel"
      trigger={
        <button
          class="message-list-date-pill surface-popover btn-reset"
          onClick={() => setOpen(!open())}
          type="button"
        >
          {props.day}
          <Icon name="caret-down" size={12} />
        </button>
      }
    >
      <div class="message-list-date-nav-actions flex-col">
        <button
          class="message-list-date-nav-btn btn-reset"
          onClick={() => jumpToDate(startOfDay(env.now()))}
          type="button"
        >
          Today
        </button>
        <button
          class="message-list-date-nav-btn btn-reset"
          onClick={() => jumpToDate(startOfDay(env.now(), -1))}
          type="button"
        >
          Yesterday
        </button>
        <button
          class="message-list-date-nav-btn btn-reset"
          onClick={() => {
            props.onJumpToBeginning();
            close();
          }}
          type="button"
        >
          Beginning of channel
        </button>
      </div>
      <label class="message-list-date-nav-input-row flex-between gap-sm">
        <span>Jump to date</span>
        <input
          class="message-list-date-nav-input input-reset"
          max={toLocalInputValue(env.now(), "date")}
          onChange={({ currentTarget: { value } }) => {
            if (!value) return;
            const [year, month, day] = value.split("-").map(Number);
            jumpToDate(new Date(defined(year), defined(month) - 1, defined(day)).getTime());
          }}
          type="date"
        />
      </label>
    </Popover>
  );
}
