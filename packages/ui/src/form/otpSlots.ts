const DIGIT = /[0-9]/;

export function toSlots(value: string, length: number) {
  return Array.from({ length }, (_, i) => value[i] ?? "");
}

export function typedDigits(inputValue: string, current: string): string[] {
  const digits = inputValue.split("").filter((char) => DIGIT.test(char));
  return digits.length > 1 && digits[0] === current ? digits.slice(1) : digits;
}

export function fillSlots(slots: string[], index: number, digits: string[]) {
  const room = Math.min(digits.length, slots.length - index);
  const next = [...slots];
  digits.slice(0, room).forEach((digit, i) => {
    next[index + i] = digit;
  });
  return { next, room };
}

export function backspaceSlots(
  slots: string[],
  index: number,
): { focus?: number; next: string[] } | undefined {
  const clear = (target: number) => slots.map((slot, i) => (i === target ? "" : slot));
  if (slots[index]) return { next: clear(index) };
  return index > 0 ? { focus: index - 1, next: clear(index - 1) } : undefined;
}
