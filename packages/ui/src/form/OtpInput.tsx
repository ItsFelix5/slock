import { clamp, defined } from "@slock/core";
import { service } from "@slock/core/solid";
import { createEffect, createSignal, For } from "solid-js";
import "./OtpInput.css";
import { useNavigationShortcuts } from "../hooks/useNavShortcuts";
import { inside, useShortcut } from "../hooks/useShortcut";
import { backspaceSlots, fillSlots, toSlots, typedDigits } from "./otpSlots";

const env = service("env");

export interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  autofocus?: boolean;
}

function selectAll(event: FocusEvent & { currentTarget: HTMLInputElement }) {
  event.currentTarget.select();
}

export default function OtpInput(props: OtpInputProps) {
  const length = () => props.length ?? 6;
  const [slots, setSlots] = createSignal(() => toSlots(props.value, length()));
  const [shake, setShake] = createSignal(false);
  const inputs: HTMLInputElement[] = [];
  let rootRef: HTMLDivElement | undefined;

  createEffect(
    () => props.error,
    (error) => {
      if (!error) return;
      setShake(true);
      focusAt(0);
      const timer = env.setTimeout(() => setShake(false), 320);
      return () => env.clearTimeout(timer);
    },
  );

  function focusAt(index: number) {
    const input = inputs[clamp(index, 0, length() - 1)];
    input?.focus();
    input?.select();
  }

  function commit(next: string[]) {
    setSlots(next);
    const code = next.join("");
    props.onChange(code);
    if (next.every(Boolean)) props.onComplete?.(code);
  }

  function fill(index: number, chars: string[]) {
    const { next, room } = fillSlots(slots(), index, chars);
    commit(next);
    focusAt(index + room);
  }

  function handleInput(index: number, event: InputEvent & { currentTarget: HTMLInputElement }) {
    const target = event.currentTarget;
    const typed = typedDigits(target.value, defined(slots()[index]));
    if (typed.length) fill(index, typed);
    else target.value = defined(slots()[index]);
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
      const result = backspaceSlots(slots(), slotIndex(event));
      if (!result) return;
      commit(result.next);
      if (result.focus !== undefined) focusAt(result.focus);
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
    <div class={["otp-input", { shake: shake() }]} ref={rootRef}>
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
              class={["otp-input-slot", { filled: !!slot }]}
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
