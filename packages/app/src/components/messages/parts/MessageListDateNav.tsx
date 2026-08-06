import { Icon, Popover } from "@slock/ui";
import { createSignal } from "solid-js";
import "./MessageListDateNav.css";

const DAY_MS = 86_400_000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Sticky pill replacing the scrollbar as the primary way to see and change
// where you are in a channel's history — shows the day currently at the top
// of the viewport, and opens quick jumps (today/yesterday/beginning) plus an
// arbitrary date picker.
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
          class="message-list-date-pill btn-reset"
          onClick={() => setOpen(!open())}
          type="button"
        >
          {props.day}
          <Icon name="caret-down" size={12} />
        </button>
      }
    >
      <div class="message-list-date-nav-actions">
        <button
          class="message-list-date-nav-btn btn-reset"
          onClick={() => jumpToDate(startOfDay(new Date()).getTime())}
          type="button"
        >
          Today
        </button>
        <button
          class="message-list-date-nav-btn btn-reset"
          onClick={() => jumpToDate(startOfDay(new Date(Date.now() - DAY_MS)).getTime())}
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
      <label class="message-list-date-nav-input-row">
        <span>Jump to date</span>
        <input
          class="message-list-date-nav-input input-reset"
          max={toDateInputValue(new Date())}
          onChange={({ currentTarget: { value } }) => {
            if (!value) return;
            const [year, month, day] = value.split("-").map(Number);
            jumpToDate(new Date(year, month - 1, day).getTime());
          }}
          type="date"
        />
      </label>
    </Popover>
  );
}
