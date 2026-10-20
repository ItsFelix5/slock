import type { DatePickerElement } from "@slock/types";

const INPUT_TYPE = { datepicker: "date", datetimepicker: "datetime-local", timepicker: "time" };

function initialValue(el: DatePickerElement) {
  if (el.type === "datepicker") return el.initial_date;
  if (el.type === "timepicker") return el.initial_time;
  if (!el.initial_datetime) return;
  const date = new Date(el.initial_datetime * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function payload(el: DatePickerElement, value: string) {
  if (el.type === "datepicker") return { selected_date: value || null };
  if (el.type === "timepicker") return { selected_time: value || null };
  return { selected_date_time: value ? Math.floor(new Date(value).getTime() / 1000) : null };
}

export default function Picker(props: {
  dispatch: (payload: Record<string, unknown>) => void;
  el: DatePickerElement;
  ready: boolean;
}) {
  return (
    <input
      class="bk-control"
      disabled={!props.ready}
      onChange={(event) => props.dispatch(payload(props.el, event.currentTarget.value))}
      type={INPUT_TYPE[props.el.type]}
      value={initialValue(props.el) ?? ""}
    />
  );
}
