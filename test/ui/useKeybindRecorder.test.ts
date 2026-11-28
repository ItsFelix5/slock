import { describe, expect, test } from "bun:test";
import { createRoot, flush } from "solid-js";
import { useKeybindRecorder } from "../../packages/ui/src/form/keybind/keybindRecorder";
import type { ShortcutCombo } from "../../packages/ui/src/shortcutCombo";

function startRecording() {
  const recorded: (ShortcutCombo | null)[] = [];
  const { dispose, recorder } = createRoot((disposeRoot) => ({
    dispose: disposeRoot,
    recorder: useKeybindRecorder((combo) => recorded.push(combo)),
  }));
  recorder.start();
  flush();
  return { dispose, recorded, recorder };
}

function press(key: string) {
  const event = Object.assign(new MessageEvent("keydown", { cancelable: true }), { key });
  window.dispatchEvent(event);
  flush();
  return event;
}

describe("useKeybindRecorder", () => {
  test("records the next key press and stops", () => {
    const { dispose, recorded, recorder } = startRecording();
    press("x");
    press("y");
    expect(recorded.map((combo) => combo?.key)).toEqual(["x"]);
    expect(recorder.recording()).toBe(false);
    dispose();
  });

  test("moving focus elsewhere cancels, so typing there is not captured", () => {
    const { dispose, recorded, recorder } = startRecording();
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    flush();
    expect(press("a").defaultPrevented).toBe(false);
    expect(recorded).toEqual([]);
    expect(recorder.recording()).toBe(false);
    input.remove();
    dispose();
  });

  test("leaving the window cancels", () => {
    const { dispose, recorded, recorder } = startRecording();
    window.dispatchEvent(new MessageEvent("blur"));
    flush();
    press("a");
    expect(recorded).toEqual([]);
    expect(recorder.recording()).toBe(false);
    dispose();
  });
});
