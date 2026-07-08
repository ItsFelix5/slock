import { createSignal } from "solid-js";

export interface Toast {
  id: number;
  text: string;
}

const [toasts, setToasts] = createSignal<Toast[]>([]);
let nextId = 1;

export function showToast(text: string, ttlMs = 2600) {
  const id = nextId++;
  setToasts((list) => [...list, { id, text }]);
  setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), ttlMs);
}

export { toasts };
