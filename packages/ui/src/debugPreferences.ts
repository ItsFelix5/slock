import { createSignal } from "solid-js";

const DEBUG_MODE_KEY = "slock-debug-mode";
const [debugMode, setDebugModeSignal] = createSignal(localStorage.getItem(DEBUG_MODE_KEY) === "1");

export function setDebugMode(on: boolean) {
  setDebugModeSignal(on);
  localStorage.setItem(DEBUG_MODE_KEY, on ? "1" : "0");
}

export { debugMode };
