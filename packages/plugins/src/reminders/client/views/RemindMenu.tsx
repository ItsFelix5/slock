import { Button, Menu, MenuItem } from "@slock/ui";
import { createSignal, For } from "solid-js";
import {
  REMINDER_OPTIONS,
  remindAboutMessage,
} from "../../../message-links/client/api/messageLinks";
import type { MessageMenuProps } from "../../../messages/client/api";

function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function nextHourInputValue(): string {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 1);
  return toLocalInputValue(date);
}

function currentMinuteInputValue(): string {
  const date = new Date();
  date.setSeconds(0, 0);
  return toLocalInputValue(date);
}

function dateDueFromInput(value: string): number | null {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : Math.floor(timestamp / 1000);
}

export default function RemindMenu(props: MessageMenuProps) {
  const [open, setOpen] = createSignal(false);
  const [customTime, setCustomTime] = createSignal(nextHourInputValue());
  const customDateDue = () => dateDueFromInput(customTime());

  const remind = (dateDue: number) => {
    setOpen(false);
    props.close();
    remindAboutMessage(props.channelId, props.msg.ts, dateDue);
  };
  const remindAtCustomTime = (event: SubmitEvent) => {
    event.preventDefault();
    const dateDue = customDateDue();
    if (!dateDue || dateDue <= Math.floor(Date.now() / 1000)) return;
    remind(dateDue);
  };

  return (
    <Menu
      class="message-more-item-wrap"
      onClose={() => setOpen(false)}
      open={open()}
      panelClass="menu-panel message-more-submenu"
      placement="left"
      trigger={
        <MenuItem icon="clock" onClick={() => setOpen(!open())}>
          Remind me
        </MenuItem>
      }
    >
      <For each={REMINDER_OPTIONS}>
        {(option) => <MenuItem onClick={() => remind(option.dateDue())}>{option.label}</MenuItem>}
      </For>
      <form class="custom-reminder-time" onSubmit={remindAtCustomTime}>
        <input
          id="custom-reminder-time"
          min={currentMinuteInputValue()}
          onInput={(event) => setCustomTime(event.currentTarget.value)}
          required
          type="datetime-local"
          value={customTime()}
        />
        <Button
          disabled={(customDateDue() ?? 0) <= Math.floor(Date.now() / 1000)}
          size="sm"
          type="submit"
          variant="primary"
        >
          Set reminder
        </Button>
      </form>
    </Menu>
  );
}
