import type { FrameRecord, InteractionRecord, Recording, ShiftRecord } from "./recording";

type LoafScript = {
  sourceURL: string;
  sourceFunctionName: string;
  sourceCharPosition: number;
  invoker: string;
  duration: number;
};

type LoafEntry = PerformanceEntry & {
  blockingDuration: number;
  styleAndLayoutStart: number;
  scripts: LoafScript[];
};

type EventEntry = PerformanceEntry & {
  interactionId: number;
  processingStart: number;
  processingEnd: number;
  target: Node | null;
};

type ShiftEntry = PerformanceEntry & {
  value: number;
  hadRecentInput: boolean;
  sources: { node: Node | null }[];
};

type ChromiumPerformance = Performance & { memory: { usedJSHeapSize: number } };

const MAX_RECORDS = 300;
const HEAP_INTERVAL_MS = 30_000;
const SLOW_EVENT_MS = 64;
const BYTES_PER_MB = 1024 * 1024;

function describe(node: Node | null): string {
  if (!(node instanceof Element)) return "unknown";
  const id = node.id ? `#${node.id}` : "";
  const classes = [...node.classList]
    .slice(0, 2)
    .map((name) => `.${name}`)
    .join("");
  return `${node.tagName.toLowerCase()}${id}${classes}`;
}

function sourceOf(script: LoafScript): string {
  if (!script.sourceURL) return "unknown";
  return `${new URL(script.sourceURL).pathname}:${script.sourceCharPosition}`;
}

function toFrame(entry: LoafEntry): FrameRecord {
  return {
    path: location.pathname,
    duration: entry.duration,
    blocking: entry.blockingDuration,
    styleLayout: entry.startTime + entry.duration - entry.styleAndLayoutStart,
    scripts: entry.scripts.map((script) => ({
      name: script.sourceFunctionName || script.invoker,
      source: sourceOf(script),
      duration: script.duration,
    })),
  };
}

function toInteraction(entry: EventEntry): InteractionRecord {
  return {
    path: location.pathname,
    type: entry.name,
    target: describe(entry.target),
    duration: entry.duration,
    delay: entry.processingStart - entry.startTime,
    processing: entry.processingEnd - entry.processingStart,
    presentation: entry.startTime + entry.duration - entry.processingEnd,
  };
}

function toShift(entry: ShiftEntry): ShiftRecord {
  return {
    path: location.pathname,
    value: entry.value,
    target: describe(entry.sources[0]?.node ?? null),
  };
}

function observe(
  type: string,
  handle: (entry: PerformanceEntry) => void,
  init: { durationThreshold?: number } = {},
) {
  const observer = new PerformanceObserver((list) => list.getEntries().forEach(handle));
  observer.observe({ type, buffered: true, ...init });
  return observer;
}

function keep<T>(list: T[], item: T) {
  list.push(item);
  if (list.length > MAX_RECORDS) list.shift();
}

export function startRecorder() {
  const recording: Recording = { frames: [], interactions: [], shifts: [], heap: [] };

  const observers = [
    observe("long-animation-frame", (entry) => keep(recording.frames, toFrame(entry as LoafEntry))),
    observe(
      "event",
      (entry) => {
        if ((entry as EventEntry).interactionId > 0)
          keep(recording.interactions, toInteraction(entry as EventEntry));
      },
      { durationThreshold: SLOW_EVENT_MS },
    ),
    observe("layout-shift", (entry) => {
      if (!(entry as ShiftEntry).hadRecentInput)
        keep(recording.shifts, toShift(entry as ShiftEntry));
    }),
  ];

  const sampleHeap = () =>
    keep(recording.heap, {
      at: performance.now(),
      mb: (performance as ChromiumPerformance).memory.usedJSHeapSize / BYTES_PER_MB,
    });
  sampleHeap();
  const timer = setInterval(sampleHeap, HEAP_INTERVAL_MS);

  return {
    recording,
    clear() {
      recording.frames.length = 0;
      recording.interactions.length = 0;
      recording.shifts.length = 0;
    },
    stop() {
      clearInterval(timer);
      for (const observer of observers) observer.disconnect();
    },
  };
}
