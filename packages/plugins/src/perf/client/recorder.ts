import { describe } from "./describe";
import { startDomChurn } from "./domChurn";
import type { FrameRecord, InteractionRecord, Recording, ShiftRecord } from "./recording";

type LoafScript = {
  sourceURL: string;
  sourceFunctionName: string;
  sourceCharPosition: number;
  invoker: string;
  duration: number;
  forcedStyleAndLayoutDuration: number;
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

function sourceOf(script: LoafScript): string {
  if (!script.sourceURL) return "unknown";
  return `${new URL(script.sourceURL).pathname}:${script.sourceCharPosition}`;
}

function toFrame(entry: LoafEntry, churn: string[]): FrameRecord {
  return {
    at: entry.startTime,
    path: location.pathname,
    duration: entry.duration,
    blocking: entry.blockingDuration,
    styleLayout: entry.startTime + entry.duration - entry.styleAndLayoutStart,
    churn,
    scripts: entry.scripts.map((script) => ({
      name: script.sourceFunctionName || script.invoker,
      source: sourceOf(script),
      duration: script.duration,
      forcedLayout: script.forcedStyleAndLayoutDuration,
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

const isLoafEntry = (entry: PerformanceEntry): entry is LoafEntry => "scripts" in entry;
const isEventEntry = (entry: PerformanceEntry): entry is EventEntry => "interactionId" in entry;
const isShiftEntry = (entry: PerformanceEntry): entry is ShiftEntry => "hadRecentInput" in entry;

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
  const interactionsById = new Map<number, InteractionRecord>();
  const domChurn = startDomChurn();

  function recordInteraction(entry: EventEntry) {
    const record = toInteraction(entry);
    const existing = interactionsById.get(entry.interactionId);
    if (!existing) {
      interactionsById.set(entry.interactionId, record);
      keep(recording.interactions, record);
    } else if (record.duration > existing.duration) Object.assign(existing, record);
  }

  const observers = [
    observe("long-animation-frame", (entry) => {
      if (isLoafEntry(entry))
        keep(
          recording.frames,
          toFrame(entry, domChurn.summarize(entry.startTime, entry.startTime + entry.duration)),
        );
    }),
    observe(
      "event",
      (entry) => {
        if (isEventEntry(entry) && entry.interactionId > 0) recordInteraction(entry);
      },
      { durationThreshold: SLOW_EVENT_MS },
    ),
    observe("layout-shift", (entry) => {
      if (isShiftEntry(entry) && !entry.hadRecentInput) keep(recording.shifts, toShift(entry));
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
      interactionsById.clear();
      recording.shifts.length = 0;
    },
    stop() {
      clearInterval(timer);
      domChurn.stop();
      for (const observer of observers) observer.disconnect();
    },
  };
}
