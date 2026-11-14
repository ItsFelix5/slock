import { service } from "@slock/core/solid";
import { Button, Menu, MenuItem } from "@slock/ui";
import { createSignal, For, Show } from "solid-js";
import {
  dateDueFromInput,
  nextHourInputValue,
  REMINDER_OPTIONS,
  toLocalInputValue,
} from "../times";

const later = service("later");

const isFuture = (dateDue: number | null): dateDue is number =>
  dateDue !== null && dateDue > Math.floor(Date.now() / 1000);

export default function RemindMenu(props: {
  channelId: string;
  close: () => void;
  onRemind?: () => void;
  ts: string;
}) {
  const [open, setOpen] = createSignal(false);
  const [customTime, setCustomTime] = createSignal(nextHourInputValue(new Date()));
  const customDateDue = () => dateDueFromInput(customTime());

  const remind = (dateDue: number) => {
    setOpen(false);
    props.close();
    later.setReminder(props.channelId, props.ts, dateDue);
    props.onRemind?.();
  };
  const remindAtCustomTime = (event: SubmitEvent) => {
    event.preventDefault();
    const dateDue = customDateDue();
    if (isFuture(dateDue)) remind(dateDue);
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
        {(option) => (
          <MenuItem onClick={() => remind(option.dateDue(new Date()))}>{option.label}</MenuItem>
        )}
      </For>
      <form class="custom-reminder-time" onSubmit={remindAtCustomTime}>
        <input
          id="custom-reminder-time"
          min={toLocalInputValue(new Date())}
          onInput={(event) => setCustomTime(event.currentTarget.value)}
          required
          type="datetime-local"
          value={customTime()}
        />
        <Button disabled={!isFuture(customDateDue())} size="sm" type="submit" variant="primary">
          Set reminder
        </Button>
      </form>
      <Show when={later.reminderDue(props.channelId, props.ts)}>
        <MenuItem
          onClick={() => {
            setOpen(false);
            props.close();
            later.clearReminder(props.channelId, props.ts);
          }}
        >
          Clear reminder
        </MenuItem>
      </Show>
    </Menu>
  );
}
