import { For } from "solid-js";
import { toasts } from "./toast";
import "./Toast.css";

export default function ToastStack() {
  return (
    <div class="toast-stack">
      <For each={toasts()}>{(t) => <div class="toast">{t.text}</div>}</For>
    </div>
  );
}
