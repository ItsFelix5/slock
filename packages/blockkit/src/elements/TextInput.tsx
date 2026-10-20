import type { TextInputElement } from "@slock/types";
import { Show } from "solid-js";

function inputType(type: string) {
  if (type === "email_text_input") return "email";
  if (type === "number_input") return "number";
  if (type === "url_text_input") return "url";
  return "text";
}

export default function TextInput(props: {
  dispatch: (payload: Record<string, unknown>) => void;
  dispatchOn: string[];
  el: TextInputElement;
  ready: boolean;
  record: (payload: Record<string, unknown>) => void;
}) {
  const numeric = () => props.el.type === "number_input";
  const allowedCharacters = () => {
    const negative = props.el.min_value === undefined || Number(props.el.min_value) < 0;
    const decimal = props.el.is_decimal_allowed;
    return new RegExp(`^[0-9${decimal ? "." : ""}${negative ? "-" : ""}]*$`);
  };

  const onBeforeInput = (event: InputEvent) => {
    if (numeric() && event.data && !allowedCharacters().test(event.data)) event.preventDefault();
  };

  const onInput = (
    event: InputEvent & { currentTarget: HTMLInputElement | HTMLTextAreaElement },
  ) => {
    const { value } = event.currentTarget;
    props.record({ value: value || null });
    if (props.dispatchOn.includes("on_character_entered")) props.dispatch({ value });
  };

  const onKeyDown = (
    event: KeyboardEvent & { currentTarget: HTMLInputElement | HTMLTextAreaElement },
  ) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    if (!props.dispatchOn.includes("on_enter_pressed")) return;
    event.preventDefault();
    props.dispatch({ value: event.currentTarget.value });
  };

  return (
    <Show
      fallback={
        <input
          class="bk-control"
          disabled={!props.ready}
          max={numeric() ? props.el.max_value : undefined}
          maxLength={props.el.max_length}
          min={numeric() ? props.el.min_value : undefined}
          onBeforeInput={onBeforeInput}
          onInput={onInput}
          onKeyDown={onKeyDown}
          placeholder={props.el.placeholder?.text}
          ref={(node) => props.el.focus_on_load && queueMicrotask(() => node.focus())}
          step={numeric() ? (props.el.is_decimal_allowed ? "any" : 1) : undefined}
          type={inputType(props.el.type)}
          value={props.el.initial_value ?? ""}
        />
      }
      when={props.el.multiline}
    >
      <textarea
        class="bk-control bk-control--textarea"
        disabled={!props.ready}
        maxLength={props.el.max_length}
        onInput={onInput}
        onKeyDown={onKeyDown}
        placeholder={props.el.placeholder?.text}
        ref={(node) => props.el.focus_on_load && queueMicrotask(() => node.focus())}
        value={props.el.initial_value ?? ""}
      />
    </Show>
  );
}
