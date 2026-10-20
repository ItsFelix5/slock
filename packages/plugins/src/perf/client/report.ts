import type { Recording } from "./recording";

const TOP_SCRIPTS = 15;
const TOP_FRAMES = 8;
const TOP_INTERACTIONS = 10;
const TOP_SHIFTS = 5;
const MS_PER_MINUTE = 60_000;

const ms = (value: number) => `${Math.round(value)} ms`;

function topScripts(recording: Recording): string[] {
  const groups = new Map<string, { count: number; total: number; max: number }>();
  for (const frame of recording.frames) {
    for (const script of frame.scripts) {
      const key = `\`${script.name}\` ${script.source}`;
      const group = groups.get(key) ?? { count: 0, total: 0, max: 0 };
      group.count += 1;
      group.total += script.duration;
      group.max = Math.max(group.max, script.duration);
      groups.set(key, group);
    }
  }
  return [...groups]
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, TOP_SCRIPTS)
    .map(([key, g]) => `- ${key}: ${g.count}x, total ${ms(g.total)}, max ${ms(g.max)}`);
}

function worstFrames(recording: Recording): string[] {
  return [...recording.frames]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, TOP_FRAMES)
    .map((frame) => {
      const scripts = [...frame.scripts]
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 3)
        .map((script) => `${script.name} ${script.source} ${ms(script.duration)}`)
        .join("; ");
      return `- ${ms(frame.duration)} on ${frame.path} (blocking ${ms(frame.blocking)}, style and layout ${ms(frame.styleLayout)}): ${scripts || "no script"}`;
    });
}

function slowInteractions(recording: Recording): string[] {
  return [...recording.interactions]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, TOP_INTERACTIONS)
    .map(
      (i) =>
        `- ${i.type} on ${i.target} at ${i.path}: ${ms(i.duration)} (delay ${ms(i.delay)}, handlers ${ms(i.processing)}, paint ${ms(i.presentation)})`,
    );
}

function shifts(recording: Recording): string[] {
  return [...recording.shifts]
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP_SHIFTS)
    .map((shift) => `- ${shift.value.toFixed(3)} on ${shift.target} at ${shift.path}`);
}

function heapLine(recording: Recording): string {
  const [first] = recording.heap;
  const last = recording.heap.at(-1);
  if (!(first && last)) return "none";
  const peak = Math.max(...recording.heap.map((sample) => sample.mb));
  const minutes = ((last.at - first.at) / MS_PER_MINUTE).toFixed(1);
  return `${Math.round(first.mb)} MB to ${Math.round(last.mb)} MB over ${minutes} min, peak ${Math.round(peak)} MB`;
}

function section(title: string, lines: string[]): string[] {
  return lines.length ? ["", `## ${title}`, ...lines] : [];
}

export function buildReport(recording: Recording): string {
  return [
    "# Slock performance recording",
    `Session ${(performance.now() / MS_PER_MINUTE).toFixed(1)} min, ${recording.frames.length} slow frames, ${recording.interactions.length} slow interactions, ${recording.shifts.length} layout shifts.`,
    "Fix the jank behind these entries with the fix-jank skill.",
    ...section("Slowest scripts by total time", topScripts(recording)),
    ...section("Worst frames", worstFrames(recording)),
    ...section("Slow interactions", slowInteractions(recording)),
    ...section("Layout shifts", shifts(recording)),
    "",
    "## Heap",
    heapLine(recording),
  ].join("\n");
}
