import { defined } from "@slock/core";
import type { FileId } from "@slock/types";
import { createResetSignal, useShortcut } from "@slock/ui";
import { createEffect, createSignal } from "solid-js";
import type { OutlineItem, OutlineSource } from "../lib/canvasOutline";

const ACTIVE_OFFSET_PX = 32;

export function useCanvasHeadings(options: {
  body: () => HTMLElement | undefined;
  content: () => unknown;
  fileId: () => FileId;
  focused: () => boolean;
}) {
  const [activeIndex, setActiveIndex] = createSignal<number | null>(null);
  const [outline, setOutline] = createResetSignal<OutlineSource | null>(options.fileId, null);
  const headings = (): OutlineItem[] => (outline()?.items() ?? []).filter((item) => item.text);

  function jumpTo(index: number) {
    outline()?.elements()[index]?.scrollIntoView({ block: "start" });
  }

  function jumpRelative(delta: number) {
    const items = headings();
    if (items.length === 0) return;
    const current = items.findIndex((heading) => heading.index === activeIndex());
    const next = Math.min(Math.max(current + delta, 0), items.length - 1);
    jumpTo(defined(items[next]).index);
  }

  const shared = {
    allowInInputs: true,
    enabled: () => options.focused() && headings().length > 1,
    group: "Canvas",
    scope: "general",
  } as const;
  useShortcut({
    ...shared,
    combo: { alt: true, key: "ArrowDown" },
    handler: () => jumpRelative(1),
    id: "canvas.jumpNextHeading",
    label: "Jump to the next heading",
  });
  useShortcut({
    ...shared,
    combo: { alt: true, key: "ArrowUp" },
    handler: () => jumpRelative(-1),
    id: "canvas.jumpPrevHeading",
    label: "Jump to the previous heading",
  });

  function updateActive() {
    const body = options.body();
    const items = headings();
    if (!body || items.length === 0) return;
    const { top } = body.getBoundingClientRect();
    const elements = outline()?.elements() ?? [];
    let current = defined(items[0]).index;
    for (const { index } of items) {
      const element = elements[index];
      if (element && element.getBoundingClientRect().top - top <= ACTIVE_OFFSET_PX) current = index;
    }
    setActiveIndex(current);
  }

  createEffect(
    () => [options.content(), outline()?.items()],
    () => void queueMicrotask(updateActive),
  );

  return { activeIndex, headings, jumpTo, setOutline, updateActive };
}
