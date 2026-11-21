import type { Setup } from "@slock/core";
import { lazyChunk } from "@slock/core/solid";
import { useShortcut } from "@slock/ui";

import { startRecorder } from "./recorder";
import { buildReport } from "./report";

const view = lazyChunk(() => import("./views/PerfTab"));

const setup: Setup = (ctx) => {
  const settings = ctx.get("settings");
  const recorder = startRecorder();
  ctx.onCleanup(recorder.stop);

  ctx.provide("perf", {
    stats: () => ({
      frames: recorder.recording.frames.length,
      interactions: recorder.recording.interactions.length,
    }),
    report: () => buildReport(recorder.recording),
    clear: recorder.clear,
  });
  ctx.add("settings.tab", { id: "perf", label: "Performance", view }, { order: 92 });
  useShortcut({
    allowInInputs: true,
    allowRepeat: false,
    combo: { key: "p", mod: true, shift: true },
    group: "App",
    handler: () => settings.open("perf"),
    id: "perf.open",
    label: "Open performance report",
    scope: "general",
  });
};

export default setup;
