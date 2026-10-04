import { createEffect, createSignal, For } from "solid-js";
import "./OtpInput.css";
import { useNavigationShortcuts } from "../useNavShortcuts";
import { inside, useShortcut } from "../useShortcut";

const DIGIT = /[0-9]/;

export interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  autofocus?: boolean;
}

function toSlots(value: string, length: number) {
  return Array.from({ length }, (_, i) => value[i] ?? "");
}

function selectAll(event: FocusEvent & { currentTarget: HTMLInputElement }) {
  event.currentTarget.select();
}

export default function OtpInput(props: OtpInputProps) {
  const length = () => props.length ?? 6;
  const [slots, setSlots] = createSignal(toSlots(props.value, length()));
  const [shake, setShake] = createSignal(false);
  let lastEmitted = props.value;
  const inputs: HTMLInputElement[] = [];
  let rootRef: HTMLDivElement | undefined;

  createEffect(() => {
    if (props.value !== lastEmitted) setSlots(toSlots(props.value, length()));
  });

  createEffect(() => {
    if (!props.error) return;
    setShake(true);
    focusAt(0);
    const timer = setTimeout(() => setShake(false), 320);
    return () => clearTimeout(timer);
  });

  function focusAt(index: number) {
    const input = inputs[Math.min(Math.max(index, 0), length() - 1)];
    input?.focus();
    input?.select();
  }

  function commit(next: string[]) {
    setSlots(next);
    const code = next.join("");
    lastEmitted = code;
    props.onChange(code);
    if (next.every(Boolean)) props.onComplete?.(code);
  }

  function fill(index: number, chars: string[]) {
    const room = Math.min(chars.length, length() - index);
    const next = [...slots()];
    chars.slice(0, room).forEach((char, i) => {
      next[index + i] = char;
    });
    commit(next);
    focusAt(index + room);
  }

  function handleInput(index: number, event: InputEvent & { currentTarget: HTMLInputElement }) {
    const target = event.currentTarget;
    const chars = target.value.split("").filter((char) => DIGIT.test(char));
    if (!chars.length) {
      target.value = slots()[index];
      return;
    }
    const typed = chars.length > 1 && chars[0] === slots()[index] ? chars.slice(1) : chars;
    fill(index, typed);
  }

  const slotIndex = (event: KeyboardEvent) =>
    event.target instanceof HTMLInputElement ? inputs.indexOf(event.target) : -1;
  useNavigationShortcuts({
    directions: ["left", "right"],
    move: (direction, event) => focusAt(slotIndex(event) + (direction === "right" ? 1 : -1)),
    root: () => rootRef,
  });
  useShortcut({
    scope: "general",
    group: "App",
    target: inside(() => rootRef),
    combo: { key: "Backspace" },
    handler: (event) => {
      const index = slotIndex(event);
      if (slots()[index]) {
        commit(slots().map((slot, i) => (i === index ? "" : slot)));
      } else if (index > 0) {
        commit(slots().map((slot, i) => (i === index - 1 ? "" : slot)));
        focusAt(index - 1);
      }
    },
    id: "otp.backspace",
    label: "Delete the previous digit",
  });

  function handlePointerDown(index: number, event: PointerEvent) {
    const firstEmpty = slots().findIndex((slot) => !slot);
    const target = firstEmpty === -1 ? index : Math.min(index, firstEmpty);
    if (target === index) return;
    event.preventDefault();
    focusAt(target);
  }

  return (
    <div class="otp-input" classList={{ shake: shake() }} ref={rootRef}>
      <For each={slots()}>
        {(slot, index) => {
          const setInputRef = (el: HTMLInputElement) => {
            inputs[index()] = el;
          };
          const onInput = (event: InputEvent & { currentTarget: HTMLInputElement }) =>
            handleInput(index(), event);
          const onPointerDown = (event: PointerEvent) => handlePointerDown(index(), event);

          return (
            <input
              ref={setInputRef}
              autocomplete={index() === 0 ? "one-time-code" : "off"}
              autofocus={props.autofocus && index() === 0}
              class="otp-input-slot"
              classList={{ filled: !!slot }}
              disabled={props.disabled}
              inputmode="numeric"
              onFocus={selectAll}
              onInput={onInput}
              onPointerDown={onPointerDown}
              value={slot}
            />
          );
        }}
      </For>
    </div>
  );
}
